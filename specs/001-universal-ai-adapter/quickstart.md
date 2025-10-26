# Universal AI Adapter - Quickstart Guide

A practical guide to get you started with the Universal AI Adapter System. This library allows you to write your code once using any provider's interface and switch backends without code changes.

## Prerequisites

- Node.js 18+ or modern browser environment
- TypeScript 5.0+
- Familiarity with async/await patterns
- API keys for the providers you want to use

---

## 1. Installation

Install the package via npm:

```bash
npm install ai.matey
```

Set up your environment variables:

```bash
# .env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
# Add other provider keys as needed
```

---

## 2. Basic Usage

### Simple Example: Anthropic Frontend → OpenAI Backend

Write your code using Anthropic's interface, but run it against OpenAI's API:

```typescript
import { Bridge, AnthropicFrontendAdapter, OpenAIBackendAdapter } from 'ai.matey';

// Create frontend and backend adapters
const frontend = new AnthropicFrontendAdapter();
const backend = new OpenAIBackendAdapter({
  apiKey: process.env.OPENAI_API_KEY
});

// Connect them with a Bridge
const bridge = new Bridge(frontend, backend);

// Use Anthropic's message format, backed by OpenAI
async function chat() {
  try {
    const response = await bridge.chat({
      model: 'gpt-4',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: 'What is the capital of France?'
        }
      ]
    });

    console.log(response.content[0].text);
    // Output: "The capital of France is Paris."
  } catch (error) {
    console.error('Chat failed:', error);
  }
}

chat();
```

### Alternative Syntax

You can also use the `connect()` method for a more fluent API:

```typescript
const bridge = frontend.connect(backend);
```

---

## 3. Streaming Responses

Get real-time streaming responses with consistent behavior across providers:

```typescript
import { Bridge, AnthropicFrontendAdapter, OpenAIBackendAdapter } from 'ai.matey';

const frontend = new AnthropicFrontendAdapter();
const backend = new OpenAIBackendAdapter({
  apiKey: process.env.OPENAI_API_KEY
});

const bridge = new Bridge(frontend, backend);

async function streamingChat() {
  try {
    // Use chatStream() instead of chat()
    const stream = await bridge.chatStream({
      model: 'gpt-4',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: 'Write a short poem about TypeScript.'
        }
      ]
    });

    // Iterate over chunks as they arrive
    for await (const chunk of stream) {
      // Check if this chunk contains content
      if (chunk.type === 'content_delta' && chunk.delta.text) {
        process.stdout.write(chunk.delta.text);
      }

      // Check if stream is complete
      if (chunk.type === 'message_stop') {
        console.log('\n\nStream completed!');
      }
    }
  } catch (error) {
    console.error('Streaming failed:', error);
  }
}

streamingChat();
```

### Canceling Streams

Use `AbortController` to cancel streams:

```typescript
async function cancelableStream() {
  const controller = new AbortController();

  // Cancel after 5 seconds
  setTimeout(() => controller.abort(), 5000);

  try {
    const stream = await bridge.chatStream({
      model: 'gpt-4',
      max_tokens: 1024,
      messages: [
        { role: 'user', content: 'Tell me a very long story...' }
      ]
    }, {
      signal: controller.signal
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_delta' && chunk.delta.text) {
        process.stdout.write(chunk.delta.text);
      }
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('\nStream was canceled by user');
    } else {
      console.error('Streaming failed:', error);
    }
  }
}
```

---

## 4. Router Usage: Dynamic Backend Selection

Use the Router to switch between backends at runtime based on your needs:

```typescript
import {
  Bridge,
  Router,
  AnthropicFrontendAdapter,
  OpenAIBackendAdapter,
  AnthropicBackendAdapter,
} from 'ai.matey';

// Create multiple backend options
const openai = new OpenAIBackendAdapter({
  apiKey: process.env.OPENAI_API_KEY
});

const anthropic = new AnthropicBackendAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Create router and register backends
const router = new Router({ defaultBackend: 'openai' })
  .register('openai', openai)
  .register('anthropic', anthropic);

const frontend = new AnthropicFrontendAdapter();
const bridge = new Bridge(frontend, router);

async function dynamicRouting() {
  // Route to specific backend
  const response1 = await bridge.chat({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello from OpenAI' }]
  }, {
    backend: 'openai'
  });

  console.log('OpenAI response:', response1.content[0].text);

  // Route to different backend
  const response2 = await bridge.chat({
    model: 'claude-3-sonnet-20240229',
    messages: [{ role: 'user', content: 'Hello from Anthropic' }]
  }, {
    backend: 'anthropic'
  });

  console.log('Anthropic response:', response2.content[0].text);
}

dynamicRouting();
```

### Automatic Fallback

Configure the router to automatically fall back to alternate backends:

```typescript
const router = new Router({
  fallbackStrategy: 'sequential', // Try backends in order
  maxRetries: 2
})
  .register('primary', openai)
  .register('fallback', anthropic)
  .setFallbackChain(['primary', 'fallback']);

async function withFallback() {
  try {
    // If 'primary' fails, router automatically tries 'fallback'
    const response = await bridge.chat({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello!' }]
    });

    console.log('Response:', response.content[0].text);
    console.log('Used backend:', response.metadata.backend);
  } catch (error) {
    console.error('All backends failed:', error);
  }
}
```

### Model-Aware Routing

Let the router automatically select backends based on model names:

```typescript
const router = new Router({
  routingStrategy: 'model-based' // Enable automatic model routing
})
  .register('openai', openai)
  .register('anthropic', anthropic);

async function modelAwareChat() {
  // Router automatically selects OpenAI backend for GPT models
  const gptResponse = await bridge.chat({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello' }]
  });

  // Router automatically selects Anthropic backend for Claude models
  const claudeResponse = await bridge.chat({
    model: 'claude-3-sonnet-20240229',
    messages: [{ role: 'user', content: 'Hello' }]
  });
}
```

---

## 5. Middleware: Adding Cross-Cutting Concerns

Add logging, transformations, and other concerns without modifying your core code:

### Basic Logging Middleware

```typescript
import {
  Bridge,
  AnthropicFrontendAdapter,
  OpenAIBackendAdapter,
  type Middleware,
  type IRChatRequest,
  type IRChatResponse
} from 'ai.matey';

// Create a simple logging middleware
const loggingMiddleware: Middleware = async (context, next) => {
  console.log('[REQUEST]', {
    requestId: context.request.metadata.requestId,
    model: context.request.model,
    messageCount: context.request.messages.length,
    timestamp: new Date().toISOString()
  });

  const response = await next();

  console.log('[RESPONSE]', {
    requestId: context.request.metadata.requestId,
    finishReason: response.finishReason,
    tokensUsed: response.usage?.totalTokens,
    timestamp: new Date().toISOString()
  });

  return response;
};

// Add middleware to bridge
const frontend = new AnthropicFrontendAdapter();
const backend = new OpenAIBackendAdapter({
  apiKey: process.env.OPENAI_API_KEY
});

const bridge = new Bridge(frontend, backend);
bridge.use(loggingMiddleware);

// All requests now include logging
async function chatWithLogging() {
  const response = await bridge.chat({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }]
  });
}
```

### Prompt Transformation Middleware

```typescript
// Middleware that adds context to all user messages
const contextMiddleware: Middleware = {
  name: 'context-injector',

  async onRequest(ir: UniversalIR.Request) {
    // Clone the IR to avoid mutations
    const modified = { ...ir };

    // Add context to the last user message
    modified.messages = ir.messages.map((msg, idx) => {
      if (msg.role === 'user' && idx === ir.messages.length - 1) {
        return {
          ...msg,
          content: `Context: You are a helpful assistant.\n\nUser query: ${msg.content}`
        };
      }
      return msg;
    });

    return modified;
  }
};
```

### Caching Middleware

```typescript
// Simple in-memory cache middleware
const cacheMiddleware: Middleware = {
  name: 'cache',
  cache: new Map<string, UniversalIR.Response>(),

  async onRequest(ir: UniversalIR.Request) {
    // Generate cache key from request
    const cacheKey = JSON.stringify({
      model: ir.model,
      messages: ir.messages
    });

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log('[CACHE] Hit!');
      // Short-circuit: return cached response
      throw new CacheHitException(cached);
    }

    // Store key for later
    (ir as any).__cacheKey = cacheKey;
    return ir;
  },

  async onResponse(ir: UniversalIR.Response, request: UniversalIR.Request) {
    // Store in cache
    const cacheKey = (request as any).__cacheKey;
    if (cacheKey) {
      this.cache.set(cacheKey, ir);
    }
    return ir;
  }
};
```

### Composing Multiple Middleware

```typescript
// Middleware executes in order
const bridge = new Bridge(frontend, backend, {
  middleware: [
    loggingMiddleware,      // Logs first
    cacheMiddleware,        // Checks cache second
    contextMiddleware       // Transforms request third
  ]
});
```

---

## 6. Error Handling

Proper error handling patterns for production use:

### Basic Try/Catch

```typescript
import { AdapterError } from 'ai.matey';

async function handleErrors() {
  try {
    const response = await bridge.chat({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }]
    });

    console.log(response.content[0].text);
  } catch (error) {
    if (error instanceof AdapterError) {
      // Adapter-specific error with rich context
      console.error('Adapter error:', {
        code: error.code,          // Error code enum
        provider: error.provider,   // Which provider failed
        message: error.message,
        cause: error.cause  // Original provider error
      });
    } else {
      // Unknown error
      console.error('Unexpected error:', error);
    }
  }
}
```

### Handling Specific Error Types

```typescript
import {
  AdapterError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  ErrorCode
} from 'ai.matey';

async function handleSpecificErrors() {
  try {
    const response = await bridge.chat({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }]
    });

    console.log(response.content[0].text);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      console.error('Authentication failed. Check your API key.');
    } else if (error instanceof RateLimitError) {
      console.error('Rate limit exceeded. Retry after:', error.retryAfter);
      // Implement exponential backoff
    } else if (error instanceof ValidationError && error.code === ErrorCode.CONTEXT_LENGTH_EXCEEDED) {
      console.error('Context length exceeded - reduce message history or max_tokens');
    } else if (error instanceof ValidationError) {
      console.error('Invalid request:', error.validationErrors);
      // Fix request parameters
    } else {
      console.error('Unexpected error:', error);
    }
  }
}
```

### Error Handling Middleware

```typescript
const errorHandlingMiddleware: Middleware = {
  name: 'error-handler',

  async onError(error: Error, request: UniversalIR.Request) {
    // Log error with context
    console.error('[ERROR HANDLER]', {
      error: error.message,
      model: request.model,
      timestamp: new Date().toISOString()
    });

    // Transform error for better user messages
    if (error instanceof RateLimitError) {
      throw new Error('Too many requests. Please try again later.');
    }

    if (error instanceof AuthenticationError) {
      throw new Error('API authentication failed. Please check your configuration.');
    }

    // Re-throw other errors
    throw error;
  }
};
```

### Retry Logic

```typescript
async function chatWithRetry(maxRetries = 3) {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await bridge.chat({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
      });
    } catch (error) {
      lastError = error as Error;

      // Only retry on rate limits or network errors
      if (error instanceof RateLimitError) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`Rate limited. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Don't retry on validation or auth errors
      throw error;
    }
  }

  throw lastError!;
}
```

---

## 7. TypeScript Setup

### Required tsconfig.json Settings

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",

    // Required for proper type safety
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitAny": true,

    // Enable latest TypeScript features
    "experimentalDecorators": false,
    "useDefineForClassFields": true,

    // For async iterators (streaming)
    "downlevelIteration": true,

    // Module resolution
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,

    // Code quality
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Type-Safe Usage Example

```typescript
import type {
  Bridge,
  IRChatRequest,
  IRChatResponse,
} from 'ai.matey';
import { AnthropicFrontendAdapter, OpenAIBackendAdapter } from 'ai.matey';

// Types are inferred automatically
const frontend = new AnthropicFrontendAdapter();
const backend = new OpenAIBackendAdapter({ apiKey: '...' });
const bridge = new Bridge(frontend, backend);

// Request uses provider-specific format
async function typeSafeChat() {
  // Response type is inferred from frontend adapter
  const response = await bridge.chat({
    model: 'gpt-4',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: 'Hello'
      }
    ]
  });

  // TypeScript knows response structure
  const text = response.content[0].text; // ✓ Type-safe
  // const invalid = response.invalid; // ✗ Compile error
}

// Working with Universal IR
function processIR(ir: IRChatRequest) {
  // Discriminated union provides type safety
  for (const message of ir.messages) {
    switch (message.role) {
      case 'user':
        console.log('User said:', message.content);
        break;
      case 'assistant':
        console.log('Assistant said:', message.content);
        break;
      case 'system':
        console.log('System instruction:', message.content);
        break;
    }
  }
}
```

### Generic Type Parameters

```typescript
// Bridge is generic over frontend adapter type
import type { Bridge, FrontendAdapter, BackendAdapter } from 'ai.matey';
import { AnthropicFrontendAdapter, OpenAIBackendAdapter } from 'ai.matey';

function createTypedBridge<F extends FrontendAdapter>(
  frontend: F,
  backend: BackendAdapter
): Bridge<F> {
  return new Bridge(frontend, backend);
}

// Type inference works through the chain
const typedBridge = createTypedBridge(
  new AnthropicFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: '...' })
);

// Request type is AnthropicRequest
await typedBridge.chat({
  model: 'gpt-4',
  max_tokens: 1024,
  messages: [/* ... */]
});
```

---

## Complete Example: Production-Ready Setup

Putting it all together:

```typescript
import {
  Bridge,
  Router,
  AnthropicFrontendAdapter,
  OpenAIBackendAdapter,
  AnthropicBackendAdapter,
  type Middleware,
  RateLimitError,
  AuthenticationError
} from 'ai.matey';

// Middleware setup
const loggingMiddleware: Middleware = async (context, next) => {
  console.log('[REQUEST]', {
    model: context.request.model,
    messages: context.request.messages.length
  });

  const response = await next();

  console.log('[RESPONSE]', { tokens: response.usage?.totalTokens });
  return response;
};

// Router setup with fallback
const router = new Router({
  defaultBackend: 'openai',
  fallbackStrategy: 'sequential'
})
  .register('openai', new OpenAIBackendAdapter({
    apiKey: process.env.OPENAI_API_KEY!
  }))
  .register('anthropic', new AnthropicBackendAdapter({
    apiKey: process.env.ANTHROPIC_API_KEY!
  }))
  .setFallbackChain(['openai', 'anthropic']);

// Bridge setup
const frontend = new AnthropicFrontendAdapter();
const bridge = new Bridge(frontend, router);
bridge.use(loggingMiddleware);

// Main application
async function main() {
  try {
    // Stream a response with fallback and logging
    const stream = await bridge.chatStream({
      model: 'gpt-4',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: 'Explain TypeScript generics in simple terms.'
        }
      ]
    });

    let fullResponse = '';

    for await (const chunk of stream) {
      if (chunk.type === 'content_delta' && chunk.delta.text) {
        process.stdout.write(chunk.delta.text);
        fullResponse += chunk.delta.text;
      }
    }

    console.log('\n\nFull response length:', fullResponse.length);

  } catch (error) {
    if (error instanceof RateLimitError) {
      console.error('Rate limited. Retry after:', error.retryAfter);
    } else if (error instanceof AuthenticationError) {
      console.error('Authentication failed. Check API keys.');
    } else {
      console.error('Unexpected error:', error);
    }
    process.exit(1);
  }
}

main();
```

---

## Next Steps

- **Advanced Routing**: Learn about fan-out patterns for parallel queries
- **Custom Adapters**: Implement adapters for additional providers
- **Semantic Drift**: Understand parameter differences between providers
- **Production Deployment**: Best practices for monitoring and error handling
- **Performance Tuning**: Optimize middleware and reduce latency

## Getting Help

- Documentation: [Full API Reference](./api-reference.md)
- Examples: [Example Repository](./examples)
- Issues: [GitHub Issues](https://github.com/ai-matey/universal-adapter/issues)

---

**Happy coding!** You're now ready to build provider-agnostic AI applications with the Universal AI Adapter System.
