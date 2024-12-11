# window.ai.prompt

(https://developer.chrome.com/docs/extensions/ai/prompt-api#model_capabilities)

## Add support to localhost

To access the Prompt API on localhost during the origin trial, you must update Chrome to the latest version. Then, follow these steps:

1. Open Chrome on one of these platforms: Windows, Mac, or Linux.
1. Go to `chrome://flags/#optimization-guide-on-device-model.
1. Select Enabled BypassPerfRequirement`.
   - This skips performance checks which may prevent you from downloading Gemini Nano onto your device.
1. Click Relaunch or restart Chrome.

1. You may have to visit `chrome://components` and check for updates to the `Optimization Guide` component.

## Use the Prompt API

Once you have requested permission to use the Prompt API, you can build your extension. There are two new extension functions available to you in the `window.ai.languageModel` namespace:

- `capabilities()` to check what the model is capable of and if it's available.
- `create()` to start a language model session.

### Model download

The Prompt API uses the Gemini Nano model in Chrome. While the API is built into Chrome, the model is downloaded separately the first time an extension uses the API.

To determine if the model is ready to use, call the asynchronous `window.ai.languageModel.capabilities()` function. It returns an AILanguageModelCapabilities object with an available field that can take three possible values:

- `no`: The current browser supports the Prompt API, but it can't be used at the moment. This could be for a number of reasons, such as insufficient available disk space available to download the model.
- `readily`: The current browser supports the Prompt API, and it can be used right away.
- `after-download`: The current browser supports the Prompt API, but it needs to download the model first.
  To trigger the model download and create the language model session, call the asynchronous window.ai.languageModel.create() function. If the response to capabilities() was 'after-download', it's best practice to listen for download progress. This way, you can inform the user in case the download takes time.

```javascript
const session = await window.ai.languageModel.create({
  monitor(m) {
    m.addEventListener("downloadprogress", (e) => {
      console.log(`Downloaded ${e.loaded} of ${e.total} bytes.`);
    });
  },
});
```

### Model capabilities

The `capabilities()` function also informs you of the language model's capabilities. Apart from available, the resulting AILanguageModelCapabilities object also has the following fields:

- defaultTopK: The default top-K value (default: 3).
- maxTopK: The maximum top-K value (8).
- defaultTemperature: The default temperature (1.0). The temperature must be between 0.0 and 2.0.

```javascript
await window.ai.languageModel.capabilities();
// {available: 'readily', defaultTopK: 3, maxTopK: 8, defaultTemperature: 1}
```

> [!NOTE]
> Note: A maxTemperature field to get the maximum temperature is specified, but not yet implemented.

### Create a session

Once you have made sure the Prompt API can run, you create a session with the `create()` function, which then lets you prompt the model with either the `prompt()` or the `promptStreaming()` functions.

#### Session options

Each session can be customized with topK and temperature using an optional options object. The default values for these parameters are returned from `window.ai.languageModel.capabilities()`.

```javascript
const capabilities = await window.ai.languageModel.capabilities();
// Initializing a new session must either specify both `topK` and
// `temperature` or neither of them.
const slightlyHighTemperatureSession = await window.ai.languageModel.create({
temperature: Math.max(capabilities.defaultTemperature \* 1.2, 2.0),
topK: capabilities.defaultTopK,
});
```

The `create()` function's optional options object also takes a `signal` field, which lets you pass an AbortSignal to destroy the session.

```javascript
const controller = new AbortController();
stopButton.onclick = () => controller.abort();

const session = await window.ai.languageModel.create({
  signal: controller.signal,
});
```

##### System prompts

With system prompts, you can give the language model some context.

```javascript
const session = await window.ai.languageModel.create({
  systemPrompt: "You are a helpful and friendly assistant.",
});
await session.prompt("What is the capital of Italy?");
// 'The capital of Italy is Rome.'#
```

##### Initial prompts

With initial prompts, you can provide the language model with context about previous interactions, for example, to allow the user to resume a stored session after a browser restart.

```javascript
const session = await window.ai.languageModel.create({
  initialPrompts: [
    { role: "system", content: "You are a helpful and friendly assistant." },
    { role: "user", content: "What is the capital of Italy?" },
    { role: "assistant", content: "The capital of Italy is Rome." },
    { role: "user", content: "What language is spoken there?" },
    {
      role: "assistant",
      content: "The official language of Italy is Italian. [...]",
    },
  ],
});
```

#### Session information

A given language model session has a maximum number of tokens it can process. You can check usage and progress toward that limit by using the following properties on the session object:

```javascript
console.log(`${session.tokensSoFar}/${session.maxTokens}
(${session.tokensLeft} left)`);
```

> [!NOTE]
> Note: There is a per prompt limit of 1,024 tokens, and the session can retain the last 4,096 tokens.

#### Session persistence

Each session keeps track of the context of the conversation. Previous interactions are taken into account for future interactions until the session's context window is full.

```javascript
const session = await window.ai.languageModel.create({
  systemPrompt:
    "You are a friendly, helpful assistant specialized in clothing choices.",
});

const result1 = await session.prompt(
  "What should I wear today? It is sunny. I am unsure between a t-shirt and a polo."
);
console.log(result1);

const result2 = await session.prompt(
  "That sounds great, but oh no, it is actually going to rain! New advice?"
);
console.log(result2);
```

### Clone a session

To preserve resources, you can clone an existing session with the `clone()` function. The conversation context is reset, but the initial prompt or the system prompts will remain intact. The `clone()` function takes an optional options object with a signal field, which lets you pass an AbortSignal to destroy the cloned session.

```javascript
const controller = new AbortController();
stopButton.onclick = () => controller.abort();

const clonedSession = await session.clone({
  signal: controller.signal,
});
```

### Prompt the model

You can prompt the model with either the `prompt()` or the `promptStreaming()` functions.

#### Non-streaming output

If you expect a short result, you can use the `prompt()` function that returns the response once it's available.

```javascript
// Start by checking if it's possible to create a session based on the
// availability of the model, and the characteristics of the device.
const { available, defaultTemperature, defaultTopK, maxTopK } =
  await window.ai.languageModel.capabilities();

if (available !== "no") {
  const session = await window.ai.languageModel.create();

  // Prompt the model and wait for the whole result to come back.
  const result = await session.prompt("Write me a poem!");
  console.log(result);
}
```

#### Streaming output

If you expect a longer response, you should use the `promptStreaming()` function which lets you show partial results as they come in from the model.

```javascript
const { available, defaultTemperature, defaultTopK, maxTopK } =
  await window.ai.languageModel.capabilities();

if (available !== "no") {
  const session = await window.ai.languageModel.create();
  // Prompt the model and stream the result:
  const stream = session.promptStreaming("Write me an extra-long poem!");
  for await (const chunk of stream) {
    console.log(chunk);
  }
}
```

`promptStreaming()` returns a ReadableStream whose chunks successively build on each other. For example, "Hello,", "Hello world,", "Hello world I am,", "Hello world I am an AI.". This isn't the intended behavior. We intend to align with other streaming APIs on the platform, where the chunks are successive pieces of a single long stream. This means the output would be a sequence like "Hello", " world", " I am", " an AI".

For now, to achieve the intended behavior, you can implement the following. This works with both the standard and the non-standard behavior.

```javascript
let result = "";
let previousChunk = "";

for await (const chunk of stream) {
  const newChunk = chunk.startsWith(previousChunk)
    ? chunk.slice(previousChunk.length)
    : chunk;
  console.log(newChunk);
  result += newChunk;
  previousChunk = chunk;
}
console.log(result);
```

#### Stop running a prompt

Both `prompt()` and `promptStreaming()` accept an optional second parameter with a signal field, which lets you stop running prompts.

```javascript
const controller = new AbortController();
stopButton.onclick = () => controller.abort();

const result = await session.prompt("Write me a poem!", {
  signal: controller.signal,
});
```

### Terminate a session

Call `destroy()` to free resources if you no longer need a session. When a session is destroyed, it can no longer be used, and any ongoing execution is aborted. You may want to keep the session around if you intend to prompt the model often since creating a session can take some time.

```javascript
await session.prompt(
'You are a friendly, helpful assistant specialized in clothing choices.'
);

session.destroy();

// The promise is rejected with an error explaining that
// the session is destroyed.
await session.prompt(
'What should I wear today? It is sunny and I am unsure
between a t-shirt and a polo.'
);
```

## API Documentation for `window.ai`

The `window.ai` API allows web applications to leverage an on-device language model for natural language processing tasks. This API provides powerful tools to create sessions, prompt the model, and manage resources.

---

### Namespace: `window.ai.languageModel`

#### Functions:

- **`capabilities()`**: Checks the language model's capabilities and availability.
- **`create(options)`**: Creates a new language model session.

---

### 1. `capabilities()`

#### Description:

Returns an object containing the model's availability status and default configuration values.

#### Returns:

`Promise<AILanguageModelCapabilities>`

#### AILanguageModelCapabilities Object:

- `available` (string): The availability of the model:
  - `no`: Not available.
  - `readily`: Ready to use.
  - `after-download`: Requires downloading the model first.
- `defaultTopK` (number): Default value for top-K sampling.
- `maxTopK` (number): Maximum value for top-K sampling.
- `defaultTemperature` (number): Default temperature for randomness.

#### Example:

```javascript
const capabilities = await window.ai.languageModel.capabilities();
console.log(capabilities);
// Output:
// { available: 'readily', defaultTopK: 3, maxTopK: 8, defaultTemperature: 1.0 }
```

---

### 2. `create(options)`

#### Description:

Initializes a session with the language model. The session is used for prompting and managing model interactions.

#### Parameters:

`options` (optional, object):

- `temperature` (number): Controls randomness (0.0 - 2.0). Defaults to `defaultTemperature`.
- `topK` (number): Limits the sampling pool to the top K tokens. Defaults to `defaultTopK`.
- `systemPrompt` (string): Sets the model's persona or behavior.
- `initialPrompts` (array): Contextual prompts to set up conversation history.
- `signal` (AbortSignal): Cancels session creation.
- `monitor` (function): Tracks download progress (if applicable).

#### Returns:

`Promise<AILanguageModelSession>`

#### Example:

```javascript
const session = await window.ai.languageModel.create({
  systemPrompt: "You are a helpful assistant.",
  monitor: (monitor) => {
    monitor.addEventListener("downloadprogress", (e) => {
      console.log(`Downloaded ${e.loaded} of ${e.total} bytes.`);
    });
  },
});
```

---

### Session: `AILanguageModelSession`

#### Methods:

- **`prompt(text, options)`**: Prompts the model for a response.
- **`promptStreaming(text, options)`**: Streams a response from the model.
- **`clone(options)`**: Creates a new session with the same initial context.
- **`destroy()`**: Terminates the session and releases resources.

#### Properties:

- `tokensSoFar` (number): Tokens used so far in the session.
- `tokensLeft` (number): Remaining tokens for the session.
- `maxTokens` (number): Maximum tokens allowed in the session.

---

### 3. `prompt(text, options)`

#### Description:

Sends a prompt to the model and waits for the complete response.

#### Parameters:

- `text` (string): The input prompt.
- `options` (optional, object):
  - `signal` (AbortSignal): Stops the prompt.

#### Returns:

`Promise<string>`

#### Example:

```javascript
const response = await session.prompt("Tell me a joke.");
console.log(response);
// Output: "Why don't scientists trust atoms? Because they make up everything."
```

---

### 4. `promptStreaming(text, options)`

#### Description:

Streams the model's response, allowing partial results to be processed.

#### Parameters:

- `text` (string): The input prompt.
- `options` (optional, object):
  - `signal` (AbortSignal): Stops the stream.

#### Returns:

`ReadableStream`

#### Example:

```javascript
const stream = await session.promptStreaming("Explain quantum physics.");
let result = "";
for await (const chunk of stream) {
  console.log(chunk);
  result += chunk;
}
console.log("Final response:", result);
```

---

### 5. `clone(options)`

#### Description:

Creates a new session with the same initial context but resets the conversation.

#### Parameters:

`options` (optional, object):

- `signal` (AbortSignal): Cancels session creation.

#### Returns:

`Promise<AILanguageModelSession>`

#### Example:

```javascript
const clonedSession = await session.clone();
```

---

### 6. `destroy()`

#### Description:

Terminates the session, releasing resources. Once destroyed, the session cannot be used again.

#### Example:

```javascript
session.destroy();
```

---

### Advanced Examples

#### Setting Context with System Prompts

```javascript
const session = await window.ai.languageModel.create({
  systemPrompt: "You are a weather forecasting assistant.",
});
const response = await session.prompt("What's the weather like today?");
console.log(response);
```

#### Streaming a Long Response

```javascript
const stream = await session.promptStreaming("Write a story about AI.");
let story = "";
for await (const chunk of stream) {
  story += chunk;
  console.log("New chunk:", chunk);
}
console.log("Full story:", story);
```

#### Monitoring Model Download Progress

```javascript
const session = await window.ai.languageModel.create({
  monitor: (monitor) => {
    monitor.addEventListener("downloadprogress", (e) => {
      console.log(`Download: ${e.loaded}/${e.total} bytes`);
    });
  },
});
```

#### Session Token Management

```javascript
console.log(`${session.tokensSoFar}/${session.maxTokens} tokens used.`);
```

This documentation outlines all essential aspects of the `window.ai` API, allowing developers to effectively utilize its features for powerful language model interactions.
