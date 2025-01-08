# ai.matey

<img src="https://raw.githubusercontent.com/johnhenry/ai.matey/main/logo.png" alt="AI.Matey Logo" style="width:256px; height:256px">

> [!TIP]
> ai.matey works well with [ai.captain](https://www.npmjs.com/package/ai.captain)

To help work with chrome's experimental [window.ai API](https://developer.chrome.com/docs/ai/built-in-apis) this package provides:

- **Documentation** for the window.ai API [here](https://github.com/johnhenry/ai.matey/blob/main/docs/api.md)

- A **mock implementation** of window.ai and it's sub-modules that can be used for testing.

- Multiple **API-Compatible clients** that mirror `window.ai`.

They can be used as drop-in replacements for `window.ai` or as standalone clients.

## Documentation: Chrome AI API

Documentation for the window.ai API is provided here: [https://github.com/johnhenry/ai.matey/blob/main/docs/api.md](https://github.com/johnhenry/ai.matey/blob/main/docs/api.md)

- Main sources:
  - https://developer.chrome.com/docs/extensions/ai/prompt-api#model_capabilities
  - https://github.com/webmachinelearning/writing-assistance-apis/blob/main/README.md

## Mock Implementation

### Installation and usage

To use the mock implementation, import the mock from `ai.matey/mock`;

#### Via CDN

```javascript
import ai from "https://cdn.jsdelivr.net/npm/ai.matey@0.0.30/mock/index.mjs";
// OR "https://ga.jspm.io/npm:ai.matey@0.0.30/mock/index.mjs"
```

#### Via NPM

```bash
npm install ai.matey
```

```javascript
import ai from "ai.matey/mock";
//...
```

### Example

```javascript
import ai from "ai.matey/mock";
const model = await ai.languageModel.create();
const poem = await model.prompt("write a poem");
console.log(poem);
```

### Polyfill

To use the polyfill implementation, import the polyfill from `ai.matey/mock/polyfill`;

This will automatically detect if the window.ai object is already defined and will not overwrite it.

```javascript
import "ai.matey/mock/polyfill";
const model = await window.ai.languageModel.create();
const poem = await model.prompt("write a poem");
console.log(poem);
```

To overwrite the window.ai object, import the polyfill from `ai.matey/mock/polyfill-overwrite`;

```javascript
import "ai.matey/mock/polyfill-overwrite";
const model = await window.ai.languageModel.create();
const poem = await model.prompt("write a poem");
console.log(poem);
```

## API Compatible Clients

Use the OpenAI compatible client standalone, or as a drop-in replacement for window.ai

Note, that unlike with the mock implementation, these require instantiation.

### Installation

#### Via CDN

Import the clients directly from the CDN

```javascript
import Ollama from "https://cdn.jsdelivr.net/npm/ai.matey@0.0.30/ollama/index.mjs";
// OR "https://ga.jspm.io/npm:ai.matey@0.0.30/ollama/index.mjs"
const ai = new Ollama();
```

#### Via NPM

```bash
npm install ai.matey
```

```javascript
import Ollama from "ai.matey/ollama";
```

### Usage

To use the a client, import the mock from `ai.matey/<client name>`;

Each client is pre-configured with a default endpoint and model that can be overwritten.

| Client      | Default Endpoint                          | Default Model                        | OpenAI API | CORS Compatible |
| ----------- | ----------------------------------------- | ------------------------------------ | ---------- | --------------- |
| gemini      | https://generativelanguage.googleapis.com | gemini-2.0-flash-exp                 | x          | ✅              |
| anthropic   | https://api.anthropic.com                 | claude-3-opus-20240229               | x          | ✅              |
| huggingface | https://api-inference.huggingface.co      | mistralai/Mixtral-8x7B-Instruct-v0.1 | x          | ✅              |
| openai      | https://api.openai.com                    | gpt-4o-mini                          | ✅         | ✅              |
| ollama      | http://localhost:11434                    | llama3.2:latest                      | ✅         | ✅              |
| mistral     | https://api.mistral.ai                    | mistral-small-latest                 | ✅         | ✅              |
| groq        | https://api.groq.com/openai               | llama3-8b-8192                       | ✅         | ✅              |
| nvidia      | https://integrate.api.nvidia.com          | meta/llama-3.1-8b-instruct           | ✅         | x               |

Except for the Ollama, you must provide a `credentials` object with a valid `apiKey` property in the constructor's settings object.

```javascript
import Client from "ai.matey/<client name>";
const ai = new Client({
  endpoint: "<endpoint>", // optional
  model: "<model>", // optional
  credentials: {
    apiKey: "<api key>", // required, except for Ollama client
  },
});
```

#### Example: Ollama

```javascript
import Ollama from "ai.matey/ollama";
// Instantiate w/ options
const ai = new Ollama();
// use the newly created `ai` object as you would `window.ai`
const model = await ai.languageModel.create();
const poem = await model.prompt("write a poem");
console.log(poem);
```

##### Example: OpenAI

```javascript
import OpenAI from "ai.matey/openai";
const ai = new OpenAI({ credentials: { apiKey: "<OPEN_AI_API_KEY>" } }); // use default endpoing
```

##### Example: createClient

The library also provides a `createClient` function that can be used to create
any of the clients via name.

```javascript
import createClient from "ai.matey";
const ai = createClient("openai", {
  credentials: { apiKey: "<OPEN_AI_API_KEY>" },
}); // use default endpoing
```

### Differences

The are some differences between the client implmentations and the base `window.ai` object.

- The `window.ai` object is a singleton, while the clients are not.

- `ai.<module>.create()` takes additional options:
  - `maxHistorySize` - the maximum number of messages to keep in the conversation history.
    - defaults to `0`
    - `-1` denotes no limit

- `<model>.chat()` simulates OpenAI chat.completions.create [requests]() and [responses]()

## Playground/Demo

Check out the playground in this repositrory. Run a static sterver (`npx live-server .`) and navigate to playground.html
