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
