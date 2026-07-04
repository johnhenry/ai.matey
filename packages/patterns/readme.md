# ai.matey.patterns

Production integration patterns for the [ai.matey](https://github.com/johnhenry/ai.matey)
Universal AI Adapter System — the validated patterns from the pattern library, packaged as
importable utilities.

```bash
npm install ai.matey.patterns
```

## Patterns

| Utility | Purpose |
|---|---|
| `createComplexityRouter()` | Route by query complexity: cheap models for simple queries, capable models for hard ones |
| `createParallelAggregator()` | Query several providers at once; fastest-wins, all-results, or a custom judge |
| `createFailoverMiddleware()` | Bridge-level failover to fallback adapters (Router users: prefer built-in fallback chains) |
| `createCostOptimizer()` | Cost-optimized routing plus a sliding-window budget ceiling |
| `createBatchProcessor()` | Bounded-concurrency queue with token-bucket rate limiting and retries |

## Quick start

```typescript
import { createComplexityRouter, createBatchProcessor } from 'ai.matey.patterns';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend';
import { OpenAIBackendAdapter, AnthropicBackendAdapter } from 'ai.matey.backend';

const router = createComplexityRouter({
  tiers: [
    { backend: 'fast', maxComplexity: 40 },
    { backend: 'powerful', maxComplexity: 100 },
  ],
  backends: {
    fast: new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY }),
    powerful: new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY }),
  },
});

const bridge = new Bridge(new OpenAIFrontendAdapter(), router);

const processor = createBatchProcessor({
  execute: (request) => bridge.chat(request),
  concurrency: 5,
  requestsPerSecond: 10,
});
```

See the [pattern guide](https://github.com/johnhenry/ai.matey/blob/main/docs/PATTERNS.md) for
the full write-ups, benchmarks, and trade-offs behind each pattern.

## License

MIT
