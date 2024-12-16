# ai.matey

This package provides four main things:

- Documentation for the [Chrome AI API](https://developer.chrome.com/docs/extensions/ai) (./docs)
- A mock implementation of the Chrome AI API to be used for testing (./mock)
- An Open AI compatible client with a matching API (./openai)
- (And maybe more in the future?)

## Documentation: Chrome AI API

Documentation for the Chrome AI API is provide [here](docs/api.md).

- Main sources:
  - https://developer.chrome.com/docs/extensions/ai/prompt-api#model_capabilities
  - https://github.com/webmachinelearning/writing-assistance-apis/blob/main/README.md

## Mock

To use the mock implementation, import the mock from `ai.matey/mock`;

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

## Built for the browser

This package is built for the browser, and can easily be imported via CDN.

```html
<html>
    <head>
    <script type="importmap">
    {
        "imports": {
            "mock.ai": "https://cdn.jsdelivr.net/npm/ai.matey@0.0.1/mock/polyfill-overwrite.mjs"
        }
    }
    </script>
    </head>
    <body>
        <scirpt type="module">
            import "mock.ai";
            const model = await window.ai.languageModel.create({
                        context: "You are an expert in creating poery.",
                        temperature: 0.7,
                        topK: 1,
                        maxTokens: 200,
                        seed: 1,
            });
            const poem = await model.prompt("write a poem");
            console.log(poem);
        </script>
    </body>
</html>
```
