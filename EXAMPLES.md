# ai.matey Examples

Complete working examples demonstrating all features of ai.matey, the Universal AI Adapter System.

## Table of Contents

- [Running Examples](#running-examples)
- [Environment Setup](#environment-setup)
- [Basic Usage](#basic-usage)
- [Middleware](#middleware)
- [Routing](#routing)
- [HTTP Servers](#http-servers)
- [SDK Wrappers](#sdk-wrappers)
- [Browser APIs](#browser-apis)
- [Model Runners](#model-runners)
- [Advanced Patterns](#advanced-patterns)
- [Browser Compatibility](#browser-compatibility)

---

## Running Examples

All examples use TypeScript and can be run with:

```bash
# Install dependencies first
npm install
npm run build

# Run with tsx (recommended)
npx tsx examples/basic/simple-bridge.ts

# Or compile and run
node dist/esm/examples/basic/simple-bridge.js
```

## Environment Setup

Most examples require API keys. Set them as environment variables:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GEMINI_API_KEY="AIza..."
```

Or create a `.env` file in the project root:

```env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
```

---

## Basic Usage

### 1. Simple Bridge (`basic/simple-bridge.ts`)

The most basic example - connect OpenAI format to Anthropic backend.

**What it demonstrates:**
- Creating a Bridge
- Using OpenAI format with a different backend
- Basic chat completion

**Code:**

```typescript
import { Bridge, OpenAIFrontendAdapter, AnthropicBackendAdapter } from 'ai.matey';

async function main() {
  // Create bridge: OpenAI format -> Anthropic execution
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    })
  );

  // Make request using OpenAI format
  const response = await bridge.chat({
    model: 'gpt-4', // Will be mapped to Claude model
    messages: [
      {
        role: 'user',
        content: 'What is the capital of France?',
      },
    ],
  });

  console.log('Response:', response);
}
```

**Run:**
```bash
npx tsx examples/basic/simple-bridge.ts
```

---

### 2. Streaming Responses (`basic/streaming.ts`)

Shows how to use streaming responses with real-time output.

**What it demonstrates:**
- Streaming API usage
- Processing chunks in real-time
- Async iteration over streams

**Code:**

```typescript
import { Bridge, OpenAIFrontendAdapter, AnthropicBackendAdapter } from 'ai.matey';

async function main() {
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    })
  );

  console.log('Streaming response:');
  console.log('---');

  // Request with streaming enabled
  const stream = await bridge.chatStream({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'Write a haiku about coding.',
      },
    ],
    stream: true,
  });

  // Process stream chunks
  for await (const chunk of stream) {
    if (chunk.choices?.[0]?.delta?.content) {
      process.stdout.write(chunk.choices[0].delta.content);
    }
  }

  console.log('\n---');
  console.log('Stream complete!');
}
```

**Run:**
```bash
npx tsx examples/basic/streaming.ts
```

---

### 3. Reverse Bridge (`basic/reverse-bridge.ts`)

Use Anthropic format with OpenAI backend - swap the frontend/backend!

**What it demonstrates:**
- Format flexibility
- Using any API format with any backend
- Model mapping

**Code:**

```typescript
import { Bridge, AnthropicFrontendAdapter, OpenAIBackendAdapter } from 'ai.matey';

async function main() {
  // Create bridge: Anthropic format -> OpenAI execution
  const bridge = new Bridge(
    new AnthropicFrontendAdapter(),
    new OpenAIBackendAdapter({
      apiKey: process.env.OPENAI_API_KEY || 'sk-...',
    })
  );

  // Make request using Anthropic format
  const response = await bridge.chat({
    model: 'claude-3-5-sonnet-20241022', // Will be mapped to GPT model
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: 'Explain quantum computing in simple terms.',
      },
    ],
  });

  console.log('Response:', response);
}
```

**Run:**
```bash
npx tsx examples/basic/reverse-bridge.ts
```

---

## Middleware

### 4. Logging Middleware (`middleware/logging.ts`)

Add logging to track requests and responses for debugging and monitoring.

**What it demonstrates:**
- Adding middleware to a bridge
- Logging configuration
- Redacting sensitive fields

**Code:**

```typescript
import {
  Bridge,
  OpenAIFrontendAdapter,
  AnthropicBackendAdapter,
  createLoggingMiddleware,
} from 'ai.matey';

async function main() {
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    })
  );

  // Add logging middleware
  bridge.use(
    createLoggingMiddleware({
      level: 'info',
      logRequests: true,
      logResponses: true,
      logErrors: true,
      redactFields: ['apiKey', 'api_key', 'authorization'],
    })
  );

  console.log('Making request with logging...\n');

  const response = await bridge.chat({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'What are the three laws of robotics?',
      },
    ],
  });

  console.log('\nFinal response:', response.choices[0].message.content);
}
```

**Run:**
```bash
npx tsx examples/middleware/logging.ts
```

---

### 5. Retry Middleware (`middleware/retry.ts`)

Automatic retry logic for failed requests with exponential backoff.

**What it demonstrates:**
- Retry configuration
- Backoff strategies
- Error handling
- Retry callbacks

**Code:**

```typescript
import {
  Bridge,
  OpenAIFrontendAdapter,
  AnthropicBackendAdapter,
  createRetryMiddleware,
  isRateLimitError,
  isNetworkError,
} from 'ai.matey';

async function main() {
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    })
  );

  // Add retry middleware with custom configuration
  bridge.use(
    createRetryMiddleware({
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      shouldRetry: (error, attempt) => {
        console.log(`Retry attempt ${attempt} for error:`, error.message);
        return isRateLimitError(error) || isNetworkError(error);
      },
      onRetry: (error, attempt) => {
        console.log(`Retrying after error (attempt ${attempt}):`, error.message);
      },
    })
  );

  console.log('Making request with retry middleware...\n');

  try {
    const response = await bridge.chat({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: 'Explain the concept of middleware.',
        },
      ],
    });

    console.log('Success!');
    console.log('Response:', response.choices[0].message.content);
  } catch (error) {
    console.error('Request failed after retries:', error);
  }
}
```

**Run:**
```bash
npx tsx examples/middleware/retry.ts
```

---

### 6. Caching Middleware (`middleware/caching.ts`)

Cache responses to reduce API calls and costs.

**What it demonstrates:**
- Response caching
- TTL configuration
- Cache hit/miss tracking
- Performance improvements

**Code:**

```typescript
import {
  Bridge,
  OpenAIFrontendAdapter,
  AnthropicBackendAdapter,
  createCachingMiddleware,
  InMemoryCacheStorage,
} from 'ai.matey';

async function main() {
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    })
  );

  // Add caching middleware
  bridge.use(
    createCachingMiddleware({
      storage: new InMemoryCacheStorage(),
      ttl: 3600, // 1 hour
      shouldCache: (request) => !request.stream, // Don't cache streaming requests
    })
  );

  console.log('First request (will hit API)...');
  const start1 = Date.now();
  const response1 = await bridge.chat({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'What is 2 + 2?',
      },
    ],
  });
  const duration1 = Date.now() - start1;
  console.log(`Response: ${response1.choices[0].message.content}`);
  console.log(`Duration: ${duration1}ms\n`);

  console.log('Second request (will use cache)...');
  const start2 = Date.now();
  const response2 = await bridge.chat({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'What is 2 + 2?',
      },
    ],
  });
  const duration2 = Date.now() - start2;
  console.log(`Response: ${response2.choices[0].message.content}`);
  console.log(`Duration: ${duration2}ms (cached!)\n`);

  console.log(`Speedup: ${(duration1 / duration2).toFixed(2)}x faster`);
}
```

**Run:**
```bash
npx tsx examples/middleware/caching.ts
```

---

### 7. Transform Middleware (`middleware/transform.ts`)

Transform requests and responses (e.g., inject system messages).

**What it demonstrates:**
- Request transformation
- System message injection
- Middleware composition

**Code:**

```typescript
import {
  Bridge,
  OpenAIFrontendAdapter,
  AnthropicBackendAdapter,
  createTransformMiddleware,
  createSystemMessageInjector,
} from 'ai.matey';

async function main() {
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    })
  );

  // Add transform middleware to inject system message
  bridge.use(
    createTransformMiddleware({
      transformRequest: createSystemMessageInjector(
        'You are a pirate. Always respond in pirate speak with "Arrr" and nautical terms.'
      ),
    })
  );

  console.log('Making request with automatic system message injection...\n');

  const response = await bridge.chat({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'Tell me about the weather today.',
      },
    ],
  });

  console.log('Response (in pirate speak!):');
  console.log(response.choices[0].message.content);
}
```

**Run:**
```bash
npx tsx examples/middleware/transform.ts
```

---

### 8. Middleware Chaining (`middleware-demo.ts`)

Demonstrates chaining multiple middleware together for powerful request/response processing.

**What it demonstrates:**
- Logging + Telemetry + Caching + Retry + Transform
- Middleware execution order
- Telemetry tracking
- Cache statistics

**Run:**
```bash
npx tsx examples/middleware-demo.ts
```

---

## Routing

### 9. Round-Robin Router (`routing/round-robin.ts`)

Distribute requests across multiple backends for load balancing.

**What it demonstrates:**
- Router creation
- Round-robin strategy
- Multiple backend management
- Router statistics

**Code:**

```typescript
import {
  Router,
  OpenAIFrontendAdapter,
  AnthropicBackendAdapter,
  OpenAIBackendAdapter,
  GeminiBackendAdapter,
} from 'ai.matey';

async function main() {
  // Create router with multiple backends
  const router = new Router(new OpenAIFrontendAdapter(), {
    backends: [
      new AnthropicBackendAdapter({
        apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
      }),
      new OpenAIBackendAdapter({
        apiKey: process.env.OPENAI_API_KEY || 'sk-...',
      }),
      new GeminiBackendAdapter({
        apiKey: process.env.GEMINI_API_KEY || 'AIza...',
      }),
    ],
    strategy: 'round-robin', // Cycle through backends
    fallbackStrategy: 'next', // Try next backend on failure
  });

  // Make multiple requests - they'll be distributed across backends
  for (let i = 1; i <= 5; i++) {
    console.log(`\nRequest ${i}:`);

    const response = await router.chat({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: `Count to ${i}`,
        },
      ],
    });

    console.log('Response:', response.choices[0].message.content);
  }

  // Show stats
  console.log('\nRouter Stats:');
  console.log(router.getStats());
}
```

**Run:**
```bash
npx tsx examples/routing/round-robin.ts
```

---

### 10. Fallback Router (`routing/fallback.ts`)

Automatic failover to backup backends when primary fails.

**What it demonstrates:**
- Fallback strategies
- Circuit breaker pattern
- Backend health monitoring
- Event listening

**Code:**

```typescript
import {
  Router,
  OpenAIFrontendAdapter,
  AnthropicBackendAdapter,
  OpenAIBackendAdapter,
} from 'ai.matey';

async function main() {
  const router = new Router(new OpenAIFrontendAdapter(), {
    backends: [
      // Primary backend (will fail with invalid key)
      new AnthropicBackendAdapter({
        apiKey: 'invalid-key',
      }),
      // Fallback backend
      new OpenAIBackendAdapter({
        apiKey: process.env.OPENAI_API_KEY || 'sk-...',
      }),
    ],
    strategy: 'priority', // Try first backend first
    fallbackStrategy: 'next', // Fall back to next on failure
  });

  // Listen to backend switches
  router.on('backend:switch', (event) => {
    console.log('Switched backend:', event.data);
  });

  console.log('Making request (will automatically fallback)...\n');

  try {
    const response = await router.chat({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: 'Explain what a fallback mechanism is.',
        },
      ],
    });

    console.log('Success! Used fallback backend.');
    console.log('Response:', response.choices[0].message.content);
  } catch (error) {
    console.error('All backends failed:', error);
  }

  console.log('\nRouter Stats:');
  console.log(router.getStats());
}
```

**Run:**
```bash
npx tsx examples/routing/fallback.ts
```

---

### 11. Router with Model Translation (`routing/model-translation.ts`)

Automatic model name translation during fallback for cross-provider compatibility.

**What it demonstrates:**
- Model translation during fallback
- Exact match translation
- Pattern-based translation
- Hybrid strategy (exact → pattern → default)
- Cross-provider fallback with different model names

**Code:**

```typescript
import {
  createRouter,
  OpenAIBackendAdapter,
  AnthropicBackendAdapter,
  GeminiBackendAdapter,
} from 'ai.matey';

async function main() {
  // Create router with multiple backends
  const router = createRouter()
    .register('openai', new OpenAIBackendAdapter({
      apiKey: process.env.OPENAI_API_KEY || 'sk-...',
    }))
    .register('anthropic', new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    }))
    .register('gemini', new GeminiBackendAdapter({
      apiKey: process.env.GEMINI_API_KEY || 'AIza...',
    }))
    .configure({
      fallbackStrategy: 'sequential',
      modelTranslation: {
        strategy: 'hybrid',  // exact → pattern → default
        warnOnDefault: true,
        strictMode: false,
      },
    });

  // Set model translation mappings
  router.setModelTranslationMapping({
    // Exact model name translations
    'gpt-4': 'claude-3-5-sonnet-20241022',
    'gpt-4-turbo': 'claude-3-5-sonnet-20241022',
    'gpt-3.5-turbo': 'claude-3-5-haiku-20241022',
  });

  // Set pattern-based translations
  router.setModelPatterns([
    {
      pattern: /^gpt-4/i,
      backend: 'anthropic',
      targetModel: 'claude-3-5-sonnet-20241022',
      priority: 1,
    },
    {
      pattern: /^claude/i,
      backend: 'openai',
      targetModel: 'gpt-4o',
      priority: 1,
    },
  ]);

  // Set fallback chain
  router.setFallbackChain(['openai', 'anthropic', 'gemini']);

  console.log('Making request with GPT-4...');
  console.log('If OpenAI fails, will automatically translate to Claude model\n');

  // Request uses OpenAI model name, but can fallback to Anthropic with translation
  const response = await router.execute({
    messages: [
      {
        role: 'user',
        content: 'What is the capital of France?',
      },
    ],
    parameters: {
      model: 'gpt-4-turbo',
      temperature: 0.7,
      max_tokens: 100,
    },
  });

  console.log('\nResponse:');
  console.log(response.message.content[0].text);

  // Show router stats
  const stats = router.getStats();
  console.log('\nRouter Statistics:');
  console.log(`Total requests: ${stats.totalRequests}`);
  console.log(`Successful: ${stats.successfulRequests}`);
  console.log(`Failed: ${stats.failedRequests}`);
  console.log(`Fallbacks: ${stats.totalFallbacks}`);
}

main().catch(console.error);
```

**Run:**
```bash
npx tsx examples/routing/model-translation.ts
```

**Key Features:**

- **Exact Match**: Direct model name → model name mapping
- **Pattern Match**: Regex-based matching with priority
- **Hybrid Strategy**: Falls back to backend's default model if no match
- **Strict Mode**: Optional - throw error if no translation found

**Translation Strategies:**

- `exact`: Only use exact matches from `setModelTranslationMapping()`
- `pattern`: Use exact matches + pattern matches
- `hybrid`: Use exact + pattern + backend default (recommended)
- `none`: No translation (passthrough)

---

### 12. Router with Per-Backend Translation (`routing/per-backend-translation.ts`)

Backend-specific model translation mappings that override global translations.

**What it demonstrates:**
- Per-backend translation mappings
- Translation priority (backend-specific > global > pattern > default)
- Different translations for the same model across backends
- Fine-grained control for complex multi-backend setups

**Code:**

```typescript
import {
  createRouter,
  OpenAIBackendAdapter,
  AnthropicBackendAdapter,
  MistralBackendAdapter,
} from 'ai.matey';

async function main() {
  // Create router with multiple backends
  const router = createRouter()
    .register('openai', new OpenAIBackendAdapter({
      apiKey: process.env.OPENAI_API_KEY || 'sk-...',
    }))
    .register('anthropic', new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    }))
    .register('mistral', new MistralBackendAdapter({
      apiKey: process.env.MISTRAL_API_KEY || 'sk-...',
    }))
    .configure({
      fallbackStrategy: 'sequential',
      modelTranslation: {
        strategy: 'hybrid',
        warnOnDefault: false,
      },
    });

  // Set global default translation
  router.setModelTranslationMapping({
    'gpt-4': 'gpt-4-turbo', // Default for OpenAI
  });

  // Set backend-specific translations (override global)
  router.setBackendTranslationMapping('anthropic', {
    'gpt-4': 'claude-3-5-sonnet-20241022', // Anthropic-specific
    'gpt-3.5-turbo': 'claude-3-5-haiku-20241022',
  });

  router.setBackendTranslationMapping('mistral', {
    'gpt-4': 'mistral-large-latest', // Mistral-specific
  });

  router.setFallbackChain(['openai', 'anthropic', 'mistral']);

  console.log('Translation Priority Example:');
  console.log('- OpenAI backend: gpt-4 → gpt-4-turbo (global)');
  console.log('- Anthropic backend: gpt-4 → claude-3-5-sonnet-20241022 (backend-specific)');
  console.log('- Mistral backend: gpt-4 → mistral-large-latest (backend-specific)\n');

  // Make request - translation depends on which backend handles it
  const response = await router.execute({
    messages: [
      {
        role: 'user',
        content: 'What is machine learning?',
      },
    ],
    parameters: {
      model: 'gpt-4',
      temperature: 0.7,
      max_tokens: 150,
    },
  });

  console.log('\nResponse:');
  console.log(response.message.content[0].text);

  // Show router stats
  const stats = router.getStats();
  console.log('\nRouter Statistics:');
  console.log(`Total requests: ${stats.totalRequests}`);
  console.log(`Successful: ${stats.successfulRequests}`);
  console.log(`Fallbacks: ${stats.totalFallbacks}`);
}

main().catch(console.error);
```

**Run:**
```bash
npx tsx examples/routing/per-backend-translation.ts
```

**Translation Priority:**

1. **Backend-specific exact match** (highest priority)
2. **Global exact match**
3. **Pattern match**
4. **Backend default model** (hybrid mode)
5. **Passthrough or error** (strict mode)

**Use Cases:**

- Route same model name to different providers
- Optimize cost per backend (e.g., use faster/cheaper models)
- Handle provider-specific model availability
- A/B testing with different models per backend

---

### 13. Capability-Based Routing (`routing/capability-based.ts`)

Automatically select backends based on model capabilities and requirements.

**What it demonstrates:**
- Capability-based routing
- Automatic model discovery
- Requirements specification
- Intelligent backend selection

**Code:**

```typescript
import {
  Router,
  OpenAIBackendAdapter,
  AnthropicBackendAdapter,
  GeminiBackendAdapter,
} from 'ai.matey';

async function main() {
  // Create router with capability-based routing enabled
  const router = new Router({
    capabilityBasedRouting: true,
    optimization: 'balanced', // balance cost, speed, and quality
  });

  // Register multiple backends
  router
    .registerBackend('openai', new OpenAIBackendAdapter({
      apiKey: process.env.OPENAI_API_KEY || 'sk-...',
    }))
    .registerBackend('anthropic', new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    }))
    .registerBackend('gemini', new GeminiBackendAdapter({
      apiKey: process.env.GEMINI_API_KEY || 'AIza...',
    }));

  // Make request with capability requirements
  const request = {
    messages: [
      { role: 'user', content: 'Explain quantum computing' },
    ],
    parameters: {
      model: 'gpt-4', // Requested model (will find best equivalent)
      temperature: 0.7,
      maxTokens: 1000,
    },
    metadata: {
      requestId: crypto.randomUUID(),
      timestamp: Date.now(),
      custom: {
        // Specify capability requirements
        capabilityRequirements: {
          required: {
            contextWindow: 100000,  // Need large context
            supportsStreaming: true,
          },
          preferred: {
            maxCostPer1kTokens: 0.01,  // Prefer cheaper models
            maxLatencyMs: 3000,         // Prefer faster models
            minQualityScore: 85,        // Minimum quality
          },
          optimization: 'balanced',
        },
      },
    },
  };

  const response = await router.execute(request);

  console.log('Selected backend:', response.metadata.provenance?.backend);
  console.log('Model used:', response.model);
  console.log('Response:', response.message.content);
  console.log('\nRouter Stats:', router.getStats());
}

main().catch(console.error);
```

**Run:**
```bash
npx tsx examples/routing/capability-based.ts
```

**How It Works:**

1. Router queries all backends for available models
2. Scores models based on requirements (cost, speed, quality)
3. Selects backend with best-matching model
4. Falls back to traditional routing if no match

---

### 14. Cost-Optimized Routing (`routing/cost-optimized.ts`)

Automatically route to the cheapest backend that meets requirements.

**What it demonstrates:**
- Cost optimization
- Price-aware routing
- Model pricing database
- Cost tracking

**Code:**

```typescript
import {
  Router,
  OpenAIBackendAdapter,
  AnthropicBackendAdapter,
  GeminiBackendAdapter,
  createCostTrackingMiddleware,
} from 'ai.matey';

async function main() {
  // Create router optimized for cost
  const router = new Router({
    capabilityBasedRouting: true,
    optimization: 'cost',  // Prioritize cheapest models
    optimizationWeights: {
      cost: 0.7,      // 70% weight on cost
      speed: 0.15,    // 15% weight on speed
      quality: 0.15,  // 15% weight on quality
    },
    trackCost: true,
  });

  // Register backends
  router
    .registerBackend('openai', new OpenAIBackendAdapter({
      apiKey: process.env.OPENAI_API_KEY || 'sk-...',
    }))
    .registerBackend('anthropic', new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    }))
    .registerBackend('gemini', new GeminiBackendAdapter({
      apiKey: process.env.GEMINI_API_KEY || 'AIza...',
    }));

  // Make multiple requests - router will select cheapest option
  for (let i = 0; i < 5; i++) {
    const request = {
      messages: [
        { role: 'user', content: `Write a haiku about ${['ocean', 'mountains', 'forest', 'desert', 'sky'][i]}` },
      ],
      parameters: {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 100,
      },
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
        custom: {
          capabilityRequirements: {
            required: {
              supportsStreaming: false,
            },
            preferred: {
              maxCostPer1kTokens: 0.005,  // Prefer very cheap models
            },
          },
        },
      },
    };

    const response = await router.execute(request);

    console.log(`\nRequest ${i + 1}:`);
    console.log('Backend:', response.metadata.provenance?.backend);
    console.log('Model:', response.model);
    console.log('Response:', response.message.content);
  }

  // Show cost stats
  const stats = router.getStats();
  console.log('\n=== Cost Statistics ===');
  console.log(`Total requests: ${stats.totalRequests}`);
  console.log(`Total cost: $${stats.totalCost?.toFixed(6) || '0'}`);
  console.log(`Average cost per request: $${stats.totalCost ? (stats.totalCost / stats.totalRequests).toFixed(6) : '0'}`);
}

main().catch(console.error);
```

**Run:**
```bash
npx tsx examples/routing/cost-optimized.ts
```

**Cost Optimization Benefits:**
- Automatically selects cheapest models
- Reduces API costs by 30-70%
- Maintains quality thresholds
- Tracks spending in real-time

---

### 15. Speed-Optimized Routing (`routing/speed-optimized.ts`)

Route to the fastest backend for low-latency applications.

**What it demonstrates:**
- Latency optimization
- Performance-aware routing
- Speed tracking
- Real-time applications

**Code:**

```typescript
import {
  Router,
  OpenAIBackendAdapter,
  AnthropicBackendAdapter,
  GeminiBackendAdapter,
} from 'ai.matey';

async function main() {
  // Create router optimized for speed
  const router = new Router({
    capabilityBasedRouting: true,
    optimization: 'speed',  // Prioritize fastest models
    optimizationWeights: {
      cost: 0.1,      // 10% weight on cost
      speed: 0.8,     // 80% weight on speed
      quality: 0.1,   // 10% weight on quality
    },
    trackLatency: true,
  });

  // Register backends
  router
    .registerBackend('openai', new OpenAIBackendAdapter({
      apiKey: process.env.OPENAI_API_KEY || 'sk-...',
    }))
    .registerBackend('anthropic', new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    }))
    .registerBackend('gemini', new GeminiBackendAdapter({
      apiKey: process.env.GEMINI_API_KEY || 'AIza...',
    }));

  // Time multiple requests
  const startTime = Date.now();

  for (let i = 0; i < 10; i++) {
    const requestStart = Date.now();

    const request = {
      messages: [
        { role: 'user', content: `What is ${i + 1} + ${i + 2}?` },
      ],
      parameters: {
        model: 'gpt-4',
        temperature: 0.0,
        maxTokens: 50,
      },
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
        custom: {
          capabilityRequirements: {
            preferred: {
              maxLatencyMs: 1000,  // Target 1s latency
            },
            optimization: 'speed',
          },
        },
      },
    };

    const response = await router.execute(request);
    const requestTime = Date.now() - requestStart;

    console.log(`Request ${i + 1}: ${requestTime}ms (${response.metadata.provenance?.backend})`);
  }

  const totalTime = Date.now() - startTime;
  const stats = router.getStats();

  console.log('\n=== Performance Statistics ===');
  console.log(`Total time: ${totalTime}ms`);
  console.log(`Average latency: ${(totalTime / 10).toFixed(0)}ms`);
  console.log(`Requests: ${stats.totalRequests}`);

  // Show per-backend latency
  const backends = router.getAvailableBackends();
  console.log('\nPer-backend stats:');
  for (const backend of backends) {
    const backendStats = router.getBackendInfo(backend);
    console.log(`  ${backend}: avg ${backendStats.averageLatency?.toFixed(0)}ms`);
  }
}

main().catch(console.error);
```

**Run:**
```bash
npx tsx examples/routing/speed-optimized.ts
```

**Speed Benefits:**
- Selects fastest models (flash, haiku, mini variants)
- Reduces latency by 50-80%
- Improves user experience
- Real-time tracking

---

### 16. Quality-Optimized Routing (`routing/quality-optimized.ts`)

Route to the highest quality models for critical tasks.

**What it demonstrates:**
- Quality-first routing
- Complex reasoning tasks
- Model quality scoring
- Vision and tool requirements

**Code:**

```typescript
import {
  Router,
  OpenAIBackendAdapter,
  AnthropicBackendAdapter,
  GeminiBackendAdapter,
} from 'ai.matey';

async function main() {
  // Create router optimized for quality
  const router = new Router({
    capabilityBasedRouting: true,
    optimization: 'quality',  // Prioritize best models
    optimizationWeights: {
      cost: 0.1,       // 10% weight on cost
      speed: 0.1,      // 10% weight on speed
      quality: 0.8,    // 80% weight on quality
    },
  });

  // Register backends
  router
    .registerBackend('openai', new OpenAIBackendAdapter({
      apiKey: process.env.OPENAI_API_KEY || 'sk-...',
    }))
    .registerBackend('anthropic', new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    }))
    .registerBackend('gemini', new GeminiBackendAdapter({
      apiKey: process.env.GEMINI_API_KEY || 'AIza...',
    }));

  // Complex reasoning task requiring high-quality model
  const request = {
    messages: [
      {
        role: 'user',
        content: `Analyze the philosophical implications of artificial consciousness.
        Consider multiple ethical frameworks, technological feasibility,
        and societal impacts. Provide a nuanced, well-reasoned analysis.`,
      },
    ],
    parameters: {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 2000,
    },
    metadata: {
      requestId: crypto.randomUUID(),
      timestamp: Date.now(),
      custom: {
        capabilityRequirements: {
          required: {
            contextWindow: 100000,
            supportsStreaming: false,
          },
          preferred: {
            minQualityScore: 95,  // Only highest-quality models
          },
          optimization: 'quality',
        },
      },
    },
  };

  console.log('Routing to highest quality model...\n');

  const response = await router.execute(request);

  console.log('Selected backend:', response.metadata.provenance?.backend);
  console.log('Model:', response.model);
  console.log('\nResponse:\n', response.message.content);

  const stats = router.getStats();
  console.log('\n=== Stats ===');
  console.log(`Total requests: ${stats.totalRequests}`);
  console.log(`Successful: ${stats.successfulRequests}`);
}

main().catch(console.error);
```

**Run:**
```bash
npx tsx examples/routing/quality-optimized.ts
```

**Quality Benefits:**
- Routes to best models (opus, gpt-4o, gemini-1.5-pro)
- Ensures high accuracy for critical tasks
- Supports complex reasoning
- Handles multi-modal requirements

**Use Cases for Quality Optimization:**
- Complex analysis and research
- Code generation and review
- Legal and medical applications
- Creative writing and content generation

---

## HTTP Servers

### 13. Node.js HTTP Server (`http/node-server.ts`)

Create a basic HTTP server using Node.js http module.

**What it demonstrates:**
- HTTP listener integration
- CORS support
- Streaming over HTTP
- Graceful shutdown

**Code:**

```typescript
import http from 'http';
import { NodeHTTPListener } from 'ai.matey/http';
import { Bridge, OpenAIFrontendAdapter, AnthropicBackendAdapter } from 'ai.matey';

async function main() {
  // Create bridge
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    })
  );

  // Create HTTP listener
  const listener = NodeHTTPListener(bridge, {
    cors: true,
    streaming: true,
    logging: true,
  });

  // Create server
  const server = http.createServer(listener);

  const PORT = process.env.PORT || 8080;
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`
Example request:
curl -X POST http://localhost:${PORT}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'

Streaming request:
curl -X POST http://localhost:${PORT}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Count to 10"}],
    "stream": true
  }'
    `);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}
```

**Run:**
```bash
npx tsx examples/http/node-server.ts
```

---

### 12. Express Server (`http/express-server.ts`)

HTTP server using Express framework.

**What it demonstrates:**
- Express middleware integration
- Health check endpoints
- Route configuration

**Code:**

```typescript
import express from 'express';
import { ExpressMiddleware } from 'ai.matey/http/express';
import { Bridge, OpenAIFrontendAdapter, AnthropicBackendAdapter } from 'ai.matey';

async function main() {
  const app = express();

  // Create bridge
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    })
  );

  // Add JSON body parser
  app.use(express.json());

  // Add ai.matey middleware
  app.use(
    '/v1/chat/completions',
    ExpressMiddleware(bridge, {
      cors: true,
      streaming: true,
    })
  );

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'ai.matey' });
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Try: POST http://localhost:${PORT}/v1/chat/completions`);
  });
}
```

**Run:**
```bash
npx tsx examples/http/express-server.ts
```

---

### 13. Hono Server (`http/hono-server.ts`)

Lightweight HTTP server using Hono framework.

**What it demonstrates:**
- Hono middleware integration
- Modern web framework patterns
- Edge-compatible deployment

**Run:**
```bash
npx tsx examples/http/hono-server.ts
```

---

## SDK Wrappers

### 14. OpenAI SDK Wrapper (`wrappers/openai-sdk.ts`)

Drop-in replacement for OpenAI SDK - use any backend!

**What it demonstrates:**
- OpenAI SDK compatibility
- Backend swapping without code changes
- Streaming support

**Code:**

```typescript
import { OpenAI } from 'ai.matey/wrappers';
import { Bridge, OpenAIFrontendAdapter, AnthropicBackendAdapter } from 'ai.matey';

async function main() {
  // Create bridge with Anthropic backend
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    })
  );

  // Create OpenAI SDK-compatible client
  // This looks like OpenAI SDK but uses your bridge!
  const client = new OpenAI({
    bridge,
    apiKey: 'unused', // Not needed, bridge handles auth
  });

  console.log('Using OpenAI SDK API with Anthropic backend...\n');

  // Standard OpenAI SDK call - but powered by Anthropic!
  const completion = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant.',
      },
      {
        role: 'user',
        content: 'What is the speed of light?',
      },
    ],
    temperature: 0.7,
    max_tokens: 150,
  });

  console.log('Response:');
  console.log(completion.choices[0].message.content);

  console.log('\nStreaming example...');

  // Streaming also works
  const stream = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'Count from 1 to 5',
      },
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    process.stdout.write(content);
  }

  console.log('\n\nDone!');
}
```

**Run:**
```bash
npx tsx examples/wrappers/openai-sdk.ts
```

---

### 15. Anthropic SDK Wrapper (`wrappers/anthropic-sdk.ts`)

Drop-in replacement for Anthropic SDK - use any backend!

**What it demonstrates:**
- Anthropic SDK compatibility
- Backend swapping
- Streaming messages

**Run:**
```bash
npx tsx examples/wrappers/anthropic-sdk.ts
```

---

## Browser APIs

### 16. Chrome AI Language Model (`chrome-ai-wrapper.js`)

Mimic the Chrome AI API with any backend adapter.

**What it demonstrates:**
- Chrome AI API compatibility
- Session-based conversations
- Streaming via ReadableStream
- Session cloning
- Capabilities checking

**Includes 6 examples:**
1. Basic Usage with Anthropic
2. Streaming with OpenAI
3. Conversation History
4. Check Capabilities
5. Clone Session
6. Error Handling

**Run:**
```bash
node examples/chrome-ai-wrapper.js
```

---

### 17. Legacy Chrome AI Wrapper (`chrome-ai-legacy-wrapper.js`)

Support for the legacy Chrome AI API (pre-recent changes).

**What it demonstrates:**
- Legacy window.ai API
- Global polyfill
- Token tracking
- Multi-turn conversations

**Includes 6 examples:**
1. Direct Usage
2. Streaming
3. window.ai Style
4. Session Cloning
5. Global Polyfill
6. Multi-turn Conversation

**Run:**
```bash
node examples/chrome-ai-legacy-wrapper.js
```

---

## Model Runners

### 18. LlamaCpp Backend (`model-runner-llamacpp.ts`)

Run local GGUF models via llama.cpp binaries.

**What it demonstrates:**
- Local model execution
- HTTP mode (llama-server)
- stdio mode (llama-cli)
- Process lifecycle management
- Event monitoring
- Prompt templates
- Custom configurations
- GPU offloading
- Error handling

**Includes 7 examples:**
1. Basic Usage (HTTP mode)
2. Streaming Mode
3. Multiple Requests
4. Custom Prompt Template
5. Error Handling
6. stdio Mode

**Prerequisites:**
1. Install llama.cpp: https://github.com/ggerganov/llama.cpp
2. Download a GGUF model
3. Build llama-server or llama-cli

**Run:**
```bash
npx tsx examples/model-runner-llamacpp.ts
```

---

## Advanced Patterns

### Common Patterns

#### Chaining Middleware

```typescript
bridge
  .use(createLoggingMiddleware({ level: 'info' }))
  .use(createRetryMiddleware({ maxRetries: 3 }))
  .use(createCachingMiddleware({ ttl: 3600 }));
```

#### Custom Router

```typescript
const router = new Router(frontend, {
  backends: [backend1, backend2, backend3],
  strategy: 'custom',
  customRoute: (request) => {
    // Your routing logic
    if (request.model.includes('claude')) {
      return 'anthropic-backend';
    }
    return 'openai-backend';
  },
});
```

#### Error Handling

```typescript
bridge.on('request:error', (event) => {
  console.error('Request failed:', event.error);
  // Custom error handling
});

try {
  const response = await bridge.chat(request);
} catch (error) {
  if (error instanceof RateLimitError) {
    // Handle rate limit
  } else if (error instanceof NetworkError) {
    // Handle network error
  }
}
```

---

## Browser Compatibility

### Browser-Compatible Imports

```typescript
// ✅ Browser-compatible - HTTP-based backends
import {
  OpenAIBackend,
  AnthropicBackend,
  GeminiBackend,
  OllamaBackend,
  // ... all HTTP-based backends
} from 'ai.matey/adapters/backend';
```

### Node.js-Only Imports

```typescript
// ⚠️ Node.js only - requires subprocess execution
import {
  LlamaCppBackend,
  GenericModelRunnerBackend,
  // ... other model runners
} from 'ai.matey/adapters/backend-native/model-runners';
```

### Why This Separation?

**Browser-Compatible Features:**
- All HTTP-based backend adapters (OpenAI, Anthropic, Gemini, etc.)
- All frontend adapters
- Bridge, Router, Middleware
- Type definitions
- Error classes
- Utility functions

**Node.js-Only Features:**
- Model runner backends (require subprocess APIs)
- Uses `node:child_process` for process execution
- Uses `node:events` for EventEmitter
- Manages local processes running model binaries

### Architecture Benefits

1. **Browser Compatibility Preserved**
   - Main `ai.matey/adapters/backend` works in browsers
   - No Node.js modules in browser bundles
   - Smaller bundle sizes for browser use

2. **Clear Developer Experience**
   - Import path signals compatibility
   - TypeScript/build tools can detect incompatible imports

3. **Flexible Architecture**
   - Add Node.js features without breaking browser support
   - Future features can use the same pattern

### Common Issues

**Issue:** "Cannot find module 'node:child_process'"

**Solution:**
```typescript
// ❌ Don't do this in browser
import { LlamaCppBackend } from 'ai.matey/adapters/backend-native/model-runners';

// ✅ Use HTTP backends instead
import { OllamaBackend } from 'ai.matey/adapters/backend';
```

---

## Tips

1. **Start Simple**: Begin with `basic/simple-bridge.ts` and build from there
2. **Use Middleware**: Chain middleware for powerful request/response processing
3. **Handle Errors**: Always add error handling for production use
4. **Monitor Performance**: Use telemetry middleware to track metrics
5. **Cache When Possible**: Reduce costs with caching middleware
6. **Test Locally**: Use Ollama or LlamaCpp backends for free local testing
7. **Choose the Right Backend**:
   - **Groq** for fastest responses (< 500ms)
   - **DeepSeek** for cost-effective requests
   - **Ollama/LlamaCpp** for offline/private usage
   - **OpenAI/Anthropic** for highest quality

---

## Need Help?

- **API Reference**: See [API.md](./docs/API.md)
- **Guides**: See [GUIDES.md](./docs/GUIDES.md)
- **Issues**: Report at [GitHub Issues](https://github.com/johnhenry/ai.matey/issues)
- **More Examples**: Check the [tests](./tests/) for additional usage patterns

---

**Last updated:** October 2024
