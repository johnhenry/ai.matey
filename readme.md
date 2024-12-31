# ai.matey

<img src="https://raw.githubusercontent.com/johnhenry/ai.matey/main/logo.png" alt="AI.Matey Logo" style="width:256px; height:256px">

> [!TIP]
> ai.matey works well with [ai.captain](https://www.npmjs.com/package/ai.captain)

To help work with chrome's experimental [window.ai API](https://developer.chrome.com/docs/ai/built-in-apis) this package provides:

- **Documentation** for the window.ai API [here](https://github.com/johnhenry/ai.matey/blob/main/docs/api.md)

- A **mock implementation** of window.ai and it's sub-modules that can be used for testing.

- Multiple **API-Compatible clients** that mirror `window.ai`.
  - _openai_
  - _gemini_
  - _anthropic_
  - _huggingface_
  - _ollama_ [^1]
  - _mistral_ [^1]
  - _groq_ [^1]
  - _nvidia_ [^1]

They can be used as drop-in replacements for `window.ai` or as standalone clients.

[^1]: These are implemented atop the _openai_ api, but with default endpoints pointing to their respective service URLs.

## Documentation: Chrome AI API

Documentation for the window.ai API is provided here: [https://github.com/johnhenry/ai.matey/blob/main/docs/api.md](https://github.com/johnhenry/ai.matey/blob/main/docs/api.md)

- Main sources:
  - https://developer.chrome.com/docs/extensions/ai/prompt-api#model_capabilities
  - https://github.com/webmachinelearning/writing-assistance-apis/blob/main/README.md

## Mock Implementation

### Installation and usage

To use the mock implementation, import the mock from `ai.matey/mock`;

#### Via NPM

```bash
npm install ai.matey
```

```javascript
import ai from "ai.matey/mock";
//...
```

#### Via CDN

```javascript
import ai from "https://cdn.jsdelivr.net/npm/ai.matey@0.0.23/mock/index.mjs";
// OR "https://ga.jspm.io/npm:ai.matey@0.0.23/mock/index.mjs"
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

#### Via NPM

```bash
npm install ai.matey
```

To use the a client, import the mock from `ai.matey/<implementation name>`;

- `import Ollama from "ai.matey/ollama";`
- `import OpenAI from "ai.matey/openai";`
- `import Gemini from "ai.matey/gemini";`
- `import Anthropic from "ai.matey/anthropic";`
- `import Mistral from "ai.matey/mistral";`
- `import Groq from "ai.matey/groq";`
- `import Nvidia from "ai.matey/nvidia";`
- `import Huggingface from "ai.matey/huggingface";`

#### Via CDN

Import the clients directly from the CDN

```javascript
import Ollama from "https://cdn.jsdelivr.net/npm/ai.matey@0.0.23/ollama/index.mjs";
// OR "https://ga.jspm.io/npm:ai.matey@0.0.23/ollama/index.mjs"
const ai = new Ollama();
```

### Usage

Each client is pre-configured with a default endpoint and model that can be overwritten.


| Client    | Default Endpoint                          | Default Model              |
| --------- | ----------------------------------------- | -------------------------- |
| Ollama    | http://localhost:11434                    | llama3.2:latest            |
| OpenAI    | https://api.openai.com                    | gpt-4o-mini                |
| Gemini    | https://generativelanguage.googleapis.com | gemini-2.0-flash-exp       |
| Anthropic | https://api.anthropic.com                 | claude-3-opus-20240229     |
| Mistral   | https://api.mistral.ai                    | mistral-small-latest       |
| Groq      | https://api.groq.com/openai               | llama3-8b-8192             |
| Nvidia    | https://integrate.api.nvidia.com          | meta/llama-3.1-8b-instruct |

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

## Playground/Demo

Check out the playground in this repositrory. Run a static sterver (`npx live-server .`) and navigate to playground.html
