# AI.Matey Demos

Interactive demos showcasing different ways to use ai.matey with multiple AI providers.

## Prerequisites

1. **Build the project:**
   ```bash
   npm install
   npm run build
   ```

2. **Configure API keys** in `web.env.local.mjs`:
   ```javascript
   export default {
     api_keys: {
       openai: "sk-...",
       anthropic: "sk-ant-...",
       gemini: "AIza...",
       deepseek: "sk-...",
       groq: "gsk_...",
       mistral: "...",
       nvidia: "nvapi-...",
       huggingface: "hf_...",
       ollama: true,  // Set to true to use local Ollama
       lmstudio: true,  // Set to true to use local LM Studio
       lmstudio_model: "phi-4-mini-reasoning-mlx",
       llamacpp_enabled: true,  // Set to true to use local models via node-llama-cpp
       llamacpp_model: "./models/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
     }
   };
   ```

   **Note:** The file `web.env.local.mjs` is gitignored. Copy your API keys into this file before running the demos.

## Available Demos

### 1. Ultimate Kitchen-Sink Demo (`demo.mjs`)

**One demo to rule them all!** This comprehensive demo showcases ALL ai.matey features in a single file (~1,020 lines).

```bash
node demo/demo.mjs
```

**What it demonstrates:**

- **PART 0:** Setup & Configuration
- **PART 1:** Backend Adapters - Basic Usage
- **PART 2:** Streaming Responses
- **PART 3:** Multi-Backend Comparison
- **PART 4:** Request/Response Conversion
- **PART 5:** Router System
- **PART 6:** Parallel Dispatch
- **PART 7:** Bridge Testing
- **PART 8:** HTTP Listener
- **PART 9:** SDK Wrappers (OpenAI, Anthropic, Chrome AI)
- **PART 10:** Summary

**Supported Backends:**
- OpenAI (gpt-4o-mini)
- Anthropic (claude-3-5-sonnet-20241022)
- Google Gemini (gemini-1.5-flash-latest)
- DeepSeek (deepseek-chat)
- Groq (llama-3.1-8b-instant)
- Mistral (mistral-tiny)
- HuggingFace (mistralai/Mistral-7B-Instruct-v0.2)
- NVIDIA (meta/llama3-8b-instruct)
- Ollama (llama3.2) - local, requires Ollama running
- LM Studio (phi-4-mini-reasoning-mlx) - local, requires LM Studio app
- LlamaCpp - local models via node-llama-cpp
- Apple - macOS 15+ Sequoia on-device AI
- Mock (echo-model) - no API key needed

**Example Output:**
```
================================================================================
🏴‍☠️ AI.MATEY - ULTIMATE KITCHEN-SINK DEMO
================================================================================

This comprehensive demo showcases ALL ai.matey features:

  0. Setup & Configuration
  1. Backend Adapters (Basic Usage)
  2. Streaming Responses
  3. Multi-Backend Comparison
  4. Request/Response Conversion
  5. Router System
  6. Parallel Dispatch
  7. Bridge Testing
  8. HTTP Listener
  9. SDK Wrappers (OpenAI, Anthropic, Chrome AI)

Enabled backends: 3
Disabled backends: 8 (missing API keys)

▶ PART 1: Backend Adapters - Basic Usage

================================================================================
🏴‍☠️ PART 1: Backend Adapters - Basic Usage
================================================================================

Using backend: OPENAI
Model: gpt-4o-mini

Response: The answer is 4.

Usage: 45 tokens
✓ Basic backend demo complete

  ✔ PART 1: Backend Adapters - Basic Usage (234ms)

[... continues through all 10 parts ...]

▶ PART 10: Summary
================================================================================
🎉 ULTIMATE DEMO COMPLETE!
================================================================================

Summary:
  ✓ Tested 3 backend(s)
  ✓ Total available: 12
  ✓ All major features verified

Features Demonstrated:
  1. Backend Adapters - Direct usage
  2. Streaming - Real-time responses
  3. Multi-Backend - Compare providers
  4. Conversions - Request/Response transforms
  5. Router - Smart routing & fallbacks
  6. Parallel Dispatch - Fan-out queries
  7. Bridge - Frontend/Backend connection
  8. HTTP Listener - Server integration
  9. SDK Wrappers - OpenAI/Anthropic/Chrome AI APIs

💡 Tip: Run this demo regularly to ensure everything is working!

  ✔ PART 10: Summary (12ms)

 ℹ tests 15
 ℹ suites 0
 ℹ pass 15
 ℹ fail 0
 ℹ cancelled 0
 ℹ skipped 7
 ℹ todo 0
 ℹ duration_ms 5432
```

### 2. Router Comprehensive Test (`router-demo.ts`)

**For developers:** Deep dive into the Router system with comprehensive tests.

```bash
npx tsx demo/router-demo.ts
```

**What it tests:**
- Backend registration and management
- Routing strategies (explicit, model-based, round-robin)
- Fallback strategies (sequential, parallel)
- Circuit breaker pattern
- Health checking
- Statistics and monitoring
- Parallel dispatch
- Bridge integration
- Router cloning

This is a complete test suite (not just a demo) that developers can use to understand and verify Router functionality.

---

## Quick Start

```bash
# 1. Build the project
npm run build

# 2. Add your API keys to web.env.local.mjs

# 3. Run the ultimate demo (tests everything!)
node demo/demo.mjs

# 4. For Router deep-dive (developers)
npx tsx demo/router-demo.ts

# Run only specific parts using test filters
node --test-name-pattern="Backend Adapters" demo/demo.mjs
node --test-name-pattern="SDK Wrapper" demo/demo.mjs
```

That's it! Two demos cover everything:
- **demo.mjs** - Ultimate kitchen-sink for users
- **router-demo.ts** - Comprehensive Router test suite for developers

### Advanced Usage

The ultimate demo uses `node:test` as a test runner, which gives you powerful filtering options:

**Skip specific parts** - Edit demo.mjs and add `.skip`:
```javascript
demo.skip('PART 9A: OpenAI SDK Wrapper', async () => {
  // This part will be skipped
});
```

**Run only specific parts** - Add `.only`:
```javascript
demo.only('PART 1: Backend Adapters - Basic Usage', async () => {
  // Only this part will run
});
```

**Filter by name pattern**:
```bash
# Run all SDK wrapper tests
node --test-name-pattern="SDK Wrapper" demo/demo.mjs

# Run streaming tests only
node --test-name-pattern="Streaming" demo/demo.mjs

# Run specific part
node --test-name-pattern="PART 4" demo/demo.mjs
```

## Configuration

### web.env.local.mjs Structure

```javascript
export default {
  api_keys: {
    // Cloud AI Providers
    openai: "sk-proj-...",
    anthropic: "sk-ant-api03-...",
    gemini: "AIza...",
    deepseek: "sk-...",
    groq: "gsk_...",
    mistral: "...",
    nvidia: "nvapi-...",
    huggingface: "hf_...",

    // Local AI Providers (set to true to enable)
    ollama: true,  // Requires Ollama running on port 11434
    lmstudio: true,  // Requires LM Studio app running
    lmstudio_model: "phi-4-mini-reasoning-mlx",
    lmstudio_baseurl: "http://localhost:1234/v1",

    // Local GGUF Models via node-llama-cpp
    llamacpp_enabled: true,
    llamacpp_model: "./models/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
    llamacpp_context_size: 2048,
    llamacpp_gpu_layers: 0,  // Set > 0 for GPU acceleration

    // Apple Intelligence (macOS 15+ Sequoia)
    apple_enabled: true,  // Set to true on macOS 15+
    apple_instructions: "You are a helpful assistant.",
    apple_max_tokens: 2048,
    apple_temperature: 0.7,
  }
};
```

### Adding a New Backend

1. Get an API key from the provider
2. Add it to `web.env.local.mjs`
3. Run `node demo/demo.mjs` to test all backends

The demo will automatically detect and test any backend with a valid API key!

## Common Patterns

### Creating a Backend

```javascript
import { OpenAIBackendAdapter } from 'ai.matey.backend/openai';

// Load API keys
const { api_keys } = await import('../web.env.local.mjs')
  .then(m => m.default);

const backend = new OpenAIBackendAdapter({
  apiKey: api_keys.openai
});
```

### Simple Request

```javascript
const response = await backend.execute({
  messages: [
    { role: 'user', content: 'Your message here' }
  ],
  parameters: {
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 100,
  },
  metadata: {
    requestId: `req-${Date.now()}`,
    timestamp: Date.now(),
  },
});
```

### Streaming Request

```javascript
const stream = backend.executeStream({
  messages: [{ role: 'user', content: 'Your message' }],
  parameters: { model: 'gpt-4o-mini' },
  metadata: { requestId: `req-${Date.now()}`, timestamp: Date.now() },
});

for await (const chunk of stream) {
  if (chunk.type === 'content' && typeof chunk.delta === 'string') {
    process.stdout.write(chunk.delta);
  }
}
```

### Extracting Response Text

```javascript
const content = response.message.content;
const text = typeof content === 'string'
  ? content
  : content.find(c => c.type === 'text')?.text || '';
```

## Troubleshooting

### "Cannot find module" Error

Make sure you've built the project:
```bash
npm run build
```

### "Error loading environment variables"

Create `web.env.local.mjs` in the project root:
```bash
cp web.env.local.example.mjs web.env.local.mjs
# Then edit with your API keys
```

### API Key Errors

- Check that your API keys are correctly formatted
- Ensure they're not expired
- Verify they have appropriate permissions

### Backend-Specific Issues

**OpenAI:**
- Requires valid API key with credits
- Check quota limits at platform.openai.com

**Anthropic:**
- API keys start with `sk-ant-`
- Check usage at console.anthropic.com

**Ollama (Local):**
- Requires Ollama running: `ollama serve`
- Default port: 11434
- Install models: `ollama pull llama3.2`
- Enable in config: Set `ollama: true` in `web.env.local.mjs`

**LlamaCpp (Local):**
- Uses node-llama-cpp native bindings (no external binaries needed)
- Install: `npm install node-llama-cpp` (already included in package.json)
- Download GGUF models from HuggingFace (e.g., TinyLlama, Llama-3, etc.)
- Configure in `web.env.local.mjs`:
  - Set `llamacpp_enabled: true` to enable
  - Set `llamacpp_model` to path to your GGUF file (can be relative or absolute)
  - Set `llamacpp_context_size` (default: 2048)
  - Set `llamacpp_gpu_layers` for GPU acceleration (0 for CPU-only)
- Example: TinyLlama 1.1B Q4_K_M model (~638MB) works well for testing

**LM Studio (Local):**
- Requires LM Studio application running: Download from [lmstudio.ai](https://lmstudio.ai)
- Default port: 1234
- Load a model in LM Studio (e.g., phi-4-mini-reasoning-mlx, llama-3, etc.)
- Start the local server in LM Studio (Developer > Start Server)
- Configure in `web.env.local.mjs`:
  - Set `lmstudio: true` to enable
  - Set `lmstudio_model` to match the model loaded in LM Studio
  - Set `lmstudio_baseurl` if using non-default port (default: http://localhost:1234/v1)
- Uses OpenAI-compatible API - no API key needed for local usage

**Apple Intelligence (macOS 15+ Sequoia):**
- Only available on macOS 15 (Sequoia) or later
- Uses on-device Apple Foundation Model
- No API key required - runs entirely on-device
- Configure in `web.env.local.mjs`:
  - Set `apple_enabled: true` to enable
  - Set `apple_instructions` for system prompt
  - Set `apple_max_tokens` for response length (default: 2048)
  - Set `apple_temperature` for creativity (default: 0.7)
- Privacy-focused - all processing happens locally
- Limited context window compared to cloud models

**Gemini:**
- Get API key from: ai.google.dev
- Some regions may have restrictions

## Available Backends

| Backend | API Key Required | Local/Cloud | Notes |
|---------|-----------------|-------------|-------|
| OpenAI | Yes | Cloud | Most reliable |
| Anthropic | Yes | Cloud | High quality |
| Gemini | Yes | Cloud | Free tier available |
| DeepSeek | Yes | Cloud | Cost-effective |
| Groq | Yes | Cloud | Very fast |
| Mistral | Yes | Cloud | EU-based |
| HuggingFace | Yes | Cloud | Many models |
| NVIDIA | Yes | Cloud | NIM endpoints |
| Ollama | No | Local | Free, requires local install |
| LlamaCpp | No | Local | Run GGUF models locally |
| LMStudio | No | Local | Free, requires local install |
| Apple | No | Local | macOS 15+ only, on-device AI |

## Performance Tips

1. **Use Groq for fastest responses** (often < 500ms)
2. **Use DeepSeek for cost-effective requests**
3. **Use Ollama, LlamaCpp, or Apple for offline/private usage**
4. **Use OpenAI/Anthropic for highest quality**
5. **Use LlamaCpp with GPU acceleration** for fast local inference
6. **Use Apple Intelligence** for privacy-first on-device AI (macOS 15+)

## Next Steps

After trying the demos, check out:

- **Examples directory** (`examples/`) - Advanced usage patterns
- **CLI Tools** (`src/cli/`) - Ollama-compatible CLI
- **Documentation** (`docs/`) - Full API reference and guides
- **Tests** (`tests/`) - More examples in test cases

## Contributing

Found an issue or want to add a demo? Contributions welcome!

---

**Quick Tip:** Run `node demo/demo.mjs` regularly as a sanity check to ensure all features are working!
