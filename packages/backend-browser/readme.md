# ai.matey.backend.browser

Browser-compatible backend adapters for AI Matey - Universal AI Adapter System.

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.backend.browser
```

## Overview

This package contains backend adapters that can run natively in browser environments without Node.js dependencies:

- **Chrome AI** - Chrome's built-in AI APIs (`window.ai`)
- **Function** - Custom function-based backends for testing and integration
- **Mock** - Mock responses for testing and development

For server-side provider adapters (OpenAI, Anthropic, etc.), see [`ai.matey.backend`](https://www.npmjs.com/package/ai.matey.backend).

## Usage

### Chrome AI Adapter

```typescript
import { ChromeAIBackendAdapter } from 'ai.matey.backend.browser';

// Chrome AI is available in Chrome 129+ with AI features enabled
const chromeAI = new ChromeAIBackendAdapter();

// Check availability
const isAvailable = await chromeAI.healthCheck();
```

### Function Backend

```typescript
import { FunctionBackendAdapter, createFunctionBackend } from 'ai.matey.backend.browser';

// Create a custom backend from a function
const customBackend = createFunctionBackend(async (request) => ({
  message: { role: 'assistant', content: 'Hello from custom backend!' },
  finishReason: 'stop',
  metadata: { requestId: request.metadata.requestId, provenance: {} },
}));
```

### Mock Backend

```typescript
import { MockBackendAdapter, createEchoBackend } from 'ai.matey.backend.browser';

// Create a mock backend for testing
const mockBackend = new MockBackendAdapter({
  defaultResponse: 'This is a test response',
});

// Or use the echo helper
const echoBackend = createEchoBackend();
```

## Subpath Imports

```typescript
import { ChromeAIBackendAdapter } from 'ai.matey.backend.browser/chrome-ai';
import { FunctionBackendAdapter } from 'ai.matey.backend.browser/function';
import { MockBackendAdapter } from 'ai.matey.backend.browser/mock';
```

## API Reference

See the TypeScript definitions for detailed API documentation.

## License

MIT - see [LICENSE](./LICENSE) for details.

## LiteRT-LM (on-device LLM, WebGPU)

Run Google's Gemma models entirely in the browser via [LiteRT-LM](https://developers.google.com/edge/litert-lm/js) — no API key, no server, no cost.

```bash
npm install ai.matey.backend.browser @litert-lm/core
```

```typescript
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend';
import { LiteRtLmBackendAdapter } from 'ai.matey.backend.browser';

const backend = new LiteRtLmBackendAdapter({
  model:
    'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.litertlm',
  maxNumTokens: 8192,
});

const bridge = new Bridge(new OpenAIFrontendAdapter(), backend);

for await (const chunk of bridge.chatStream({
  model: 'gemma-4-E2B-it-litert-lm',
  messages: [{ role: 'user', content: 'Write a haiku about tide pools.' }],
  stream: true,
})) {
  render(chunk.choices?.[0]?.delta?.content ?? '');
}

// Free GPU/WASM memory when done with the model
await backend.dispose();
```

### Requirements & notes

- **WebGPU** (Chrome 113+, Safari 17.4+, Firefox 121+). Browser only — no Node.js.
- **Cross-origin isolation** may be required for threaded WASM: serve your page with
  `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`.
- **Model downloads are large** (hundreds of MB to GBs). Engines are cached per model URL across
  adapter instances, so the download/compile happens once per page.
- **Web SDK limits** (early preview): text-only, no tool calling, no sampler parameters
  (`temperature`/`topK`/`seed` are dropped with an IR warning). Prior conversation turns are
  flattened into a transcript prefix (each request opens a fresh conversation).
- Models: [litert-community on Hugging Face](https://huggingface.co/litert-community) —
  Gemma-4 E2B (faster) and E4B (better), under the Gemma license.
- Naming note: `@litertjs/core` ("LiteRT.js") is Google's tensor-level runtime and cannot run chat
  models — this adapter wraps **LiteRT-LM** (`@litert-lm/core`), the conversation runtime.
