# ai.matey

<img src="https://raw.githubusercontent.com/johnhenry/ai.matey/main/logo.png" alt="AI.Matey Logo" style="width:256px; height:256px">

> [!TIP]
> ai.matey works well with [ai.captain](https://www.npmjs.com/package/ai.captain)

## Docs, Mocks, and a Knockoff

To help work with chrome's experimental [window.ai API](https://developer.chrome.com/docs/ai/built-in-apis) this package provides:

- **Documentation** for the window.ai API [here](https://github.com/johnhenry/ai.matey/blob/main/docs/api.md)

- A **mock implementation** of window.ai and it's sub-modules that can be used for testing.

- An **Open AI API-compatible client** that mirrors window.ai. It can be used as a drop-in replacement for the window.ai object if it is not available or not working.

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
import ai from "https://cdn.jsdelivr.net/npm/ai.matey@0.0.9/mock/index.mjs";
//...
```

OR

```javascript
import ai from "https://ga.jspm.io/npm:ai.matey@0.0.9/mock/index.mjs";
//...
```

### Example

```javascript
import * as ai from "ai.matey/mock";
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

## OpenAI Compatible Client

Use the OpenAI compatible client standalone, or as a drop-in replacement for window.ai

Note, that unlike with the mock implementation, the OpenAI client requires instantiation.

### Installation and usage

To use the mock implementation, import the mock from `ai.matey/openai`;

#### Via NPM

```bash
npm install ai.matey
```

```javascript
import AI from "ai.matey/openai";
const ai = new AI(/* options */);
//...
```

#### Via CDN

```javascript
import ai from "https://cdn.jsdelivr.net/npm/ai.matey@0.0.9/openai/index.mjs";
const ai = new AI(/* options */);

//...
```

OR

```javascript
import AI from "https://ga.jspm.io/npm:ai.matey@0.0.9/openai/index.mjs";
const ai = new AI(/* options */);
//...
```

### Example

```javascript
import AI from "ai.matey/openai";
window.ai = new AI({
  endpoint: "http://localhost:11434/v1/chat/completions",
  credentials: {
    apiKey: "123",
  },
  model: "llama3.2:latest",
});
const model = await window.ai.languageModel.create();
const poem = await model.prompt("write a poem");
console.log(poem);
```

## Playground/Demo

Check out playground in this repositrory. Run a static sterver (npx live-server .) and navigate to playground.html
