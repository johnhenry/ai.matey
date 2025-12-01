# ai.matey Examples

This directory contains **35+ runnable examples** demonstrating all features of the ai.matey Universal AI Adapter System, organized into 10 progressive categories from beginner to advanced.

## 📁 Directory Structure

```
examples/
├── 01-basics/              ⭐ Beginner (4 examples)
├── 02-providers/           ⭐ Beginner (5 examples)
├── 03-middleware/          ⭐⭐ Intermediate (6 examples)
├── 04-routing/             ⭐⭐ Intermediate (5 examples)
├── 05-http-servers/        ⭐⭐ Intermediate (4 examples)
├── 06-sdk-wrappers/        ⭐⭐ Intermediate (4 examples)
├── 07-advanced-patterns/   ⭐⭐⭐ Advanced (5 examples)
├── 08-observability/       ⭐⭐⭐ Advanced (4 examples)
├── 09-react/               🎯 Specialized (1 example)
├── 10-cli-tools/           🎯 Specialized (1 example)
└── _shared/                📦 Shared utilities
```

## 🚀 Quick Start

### Prerequisites

1. **Install Dependencies**
   ```bash
   cd /path/to/ai.matey
   npm install
   npm run build
   ```

2. **Set Up API Keys**

   Create a `.env` file in the project root:
   ```bash
   # Cloud AI Providers
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...
   GOOGLE_API_KEY=...          # For Gemini
   DEEPSEEK_API_KEY=...
   GROQ_API_KEY=...

   # Local Models (optional)
   OLLAMA_ENABLED=true
   LMSTUDIO_ENABLED=true
   ```

### Running Examples

All examples are written in TypeScript and can be run with `tsx`:

```bash
# Run any example
npx tsx examples/01-basics/01-hello-world.ts
npx tsx examples/03-middleware/01-logging.ts
npx tsx examples/07-advanced-patterns/01-streaming-aggregation.ts
```

## 📚 Example Categories

### 01. Basics ⭐ (Beginner)
**Learn the fundamentals of ai.matey**

- `01-hello-world.ts` - Your first bridge (OpenAI format → Anthropic execution)
- `02-streaming.ts` - Stream responses in real-time
- `03-error-handling.ts` - Proper error handling patterns
- `04-reverse-bridge.ts` - Swap frontend/backend (Anthropic → OpenAI)

**Start here if:** You're new to ai.matey or want to understand core concepts.

### 02. Providers ⭐ (Beginner)
**Work with different AI providers**

- `01-openai.ts` - OpenAI backend configuration
- `02-anthropic.ts` - Anthropic (Claude) backend
- `03-gemini.ts` - Google Gemini backend
- `04-local-ollama.ts` - Local models with Ollama
- `05-multi-provider.ts` - Using multiple providers

**Start here if:** You want to understand provider-specific features.

### 03. Middleware ⭐⭐ (Intermediate)
**Add powerful middleware to your pipelines**

- `01-logging.ts` - Request/response logging with sanitization
- `02-caching.ts` - Response caching (1000x speedup for duplicates)
- `03-retry.ts` - Automatic retry with exponential backoff
- `04-transform.ts` - Request/response transformation
- `05-cost-tracking.ts` - Track API costs across providers
- `06-middleware-stack.ts` - Compose multiple middleware

**Start here if:** You need logging, caching, or retry logic.

### 04. Routing ⭐⭐ (Intermediate)
**Intelligently route requests across providers**

- `01-round-robin.ts` - Load balance across backends
- `02-fallback.ts` - Automatic failover to backup providers
- `03-complexity-based.ts` - Route by query complexity
- `04-parallel-dispatch.ts` - Fan-out to multiple providers
- `05-cost-optimized.ts` - Choose cheapest provider (84% savings!)

**Start here if:** You need multi-provider routing or failover.

### 05. HTTP Servers ⭐⭐ (Intermediate)
**Integrate with web frameworks**

- `01-node-http.ts` - Native Node.js HTTP server
- `02-express.ts` - Express.js integration
- `03-hono.ts` - Hono framework (edge-ready)
- `04-streaming-http.ts` - SSE streaming over HTTP

**Start here if:** You're building an HTTP API.

### 06. SDK Wrappers ⭐⭐ (Intermediate)
**Drop-in replacements for official SDKs**

- `01-openai-sdk.ts` - OpenAI SDK wrapper
- `02-anthropic-sdk.ts` - Anthropic SDK wrapper
- `03-chrome-ai.ts` - Chrome AI API compatibility
- `04-wrapper-utils.ts` - Stream processing utilities (50+ functions)

**Start here if:** You want SDK compatibility.

### 07. Advanced Patterns ⭐⭐⭐ (Advanced)
**Production-ready patterns**

- `01-streaming-aggregation.ts` - Parallel streaming from multiple providers
- `02-websocket-chat.ts` - Real-time WebSocket chat with multiple backends
- `03-batch-processing.ts` - Process requests in batches (21+ req/s)
- `04-health-monitoring.ts` - Continuous provider health checks
- `05-middleware-chain.ts` - Complex middleware composition (<10ms overhead)

**Start here if:** You're building production systems.

### 08. Observability ⭐⭐⭐ (Advanced)
**Monitor and trace your AI requests**

- `01-jaeger.ts` - OpenTelemetry + Jaeger (local)
- `02-honeycomb.ts` - Honeycomb.io integration
- `03-sampling.ts` - Sampling strategies for tracing
- `04-multi-provider.ts` - Trace across multiple providers

**Start here if:** You need monitoring and observability.

### 09. React 🎯 (Specialized)
**Frontend integration with React**

- `01-hooks.tsx` - useChat, useCompletion, useObject hooks

**Start here if:** You're building React applications.

### 10. CLI Tools 🎯 (Specialized)
**Command-line utilities**

- `01-cli-basics.ts` - Format conversion, backend generation

**Start here if:** You need CLI tooling.

## 🛠️ Shared Utilities

The `_shared/` directory contains utilities used across all examples:

- **env-loader.ts** - Load API keys from environment
- **helpers.ts** - Display formatting, streaming, timing utilities
- **types.ts** - Common TypeScript types

### Using Shared Utilities

```typescript
import { requireAPIKey, displayAPIKeys } from '../_shared/env-loader.js';
import { displayResponse, displayStream } from '../_shared/helpers.js';

// Load API key (throws if not set)
const apiKey = requireAPIKey('anthropic');

// Display available keys
displayAPIKeys();

// Format response output
displayResponse(response);

// Display streaming output
await displayStream(stream);
```

## 📖 Example Template

Each example follows this structure:

```typescript
/**
 * [Example Title] - [Category]
 *
 * Demonstrates:
 * - [Key concept 1]
 * - [Key concept 2]
 *
 * Prerequisites:
 * - [Requirement 1]
 * - [Requirement 2]
 *
 * Run:
 *   npx tsx examples/[category]/[filename].ts
 *
 * Expected Output:
 *   [Description of expected output]
 */

import { Bridge } from 'ai.matey.core';
import { requireAPIKey } from '../_shared/env-loader.js';
import { displayExampleInfo, displayResponse } from '../_shared/helpers.js';

async function main() {
  displayExampleInfo('Title', 'Description', ['Prerequisites']);

  try {
    // Example code here
  } catch (error) {
    displayError(error, 'example context');
    process.exit(1);
  }
}

main();
```

## 🎯 Learning Path

### Beginner Path (Start Here!)
1. 01-basics/01-hello-world.ts
2. 01-basics/02-streaming.ts
3. 02-providers/01-openai.ts
4. 02-providers/05-multi-provider.ts

### Intermediate Path
1. 03-middleware/01-logging.ts
2. 03-middleware/02-caching.ts
3. 04-routing/01-round-robin.ts
4. 05-http-servers/02-express.ts

### Advanced Path
1. 04-routing/05-cost-optimized.ts
2. 07-advanced-patterns/01-streaming-aggregation.ts
3. 07-advanced-patterns/04-health-monitoring.ts
4. 08-observability/01-jaeger.ts

## 🐛 Troubleshooting

### "Missing API Key" Error
```
Error: Missing required API key: ANTHROPIC_API_KEY
```
**Solution:** Set the API key in your `.env` file or environment.

### "Module not found" Error
```
Error: Cannot find module 'ai.matey.core'
```
**Solution:** Run `npm install && npm run build` from the monorepo root.

### "Connection refused" (Local Models)
```
Error: connect ECONNREFUSED 127.0.0.1:11434
```
**Solution:** Start Ollama/LM Studio before running the example.

## 📝 Additional Resources

- [Documentation Site](/) - Full documentation
- [API Reference](/api) - Complete API docs
- [Architecture Guide](/guides/architecture/ir-format) - Understand the IR format
- [Contributing](/contributing/overview) - Contribute to ai.matey

## 💡 Tips

- **Start Simple**: Begin with `01-basics/01-hello-world.ts`
- **Read Comments**: Every example has detailed inline comments
- **Experiment**: Modify examples to learn how they work
- **Use Shared Utils**: The `_shared/` directory has helpful utilities
- **Check Prerequisites**: Each example lists what you need to run it

---

Happy coding with ai.matey! 🚢⚓
