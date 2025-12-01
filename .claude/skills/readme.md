# ai.matey Adapter & Wrapper Creation Skills

This directory contains detailed Claude skills for creating new adapters and wrappers for the ai.matey Universal AI Adapter System.

## Available Skills

### 1. Update Backend Model Lists (`update-backend-model-lists.md`)

**Use when:** Checking or updating hard-coded model lists for providers, performing quarterly maintenance, or verifying model list currency.

**What you'll do:** Check provider documentation, compare with current lists, update model definitions, and maintain roadmap documentation.

**Key features:**
- Quarterly review process for Anthropic and OpenAI models
- Documentation fetching and comparison
- Model capability verification
- Roadmap synchronization
- Test validation

**Providers covered:** Anthropic (critical), OpenAI (fallback list only)

**Estimated time:** 30 minutes - 1 hour for quarterly review

### 2. Frontend Adapter Creator (`create-frontend-adapter.md`)

**Use when:** Creating a new frontend adapter to convert a provider's API format to Universal IR.

**What you'll create:** A TypeScript class that implements `FrontendAdapter<TRequest, TResponse, TStreamChunk>` interface.

**Key features:**
- Request normalization (provider → IR)
- Response denormalization (IR → provider)
- Streaming conversion (IR stream → provider stream)
- System message strategy handling
- Parameter mapping and validation

**Example providers:** OpenAI, Anthropic, Gemini, Mistral, Cohere, Perplexity

**Estimated time:** 2-4 hours for complete implementation with tests

### 3. Backend HTTP Adapter Creator (`create-backend-http-adapter.md`)

**Use when:** Creating a new backend adapter to call a provider's HTTP API.

**What you'll create:** A TypeScript class that implements `BackendAdapter<TRequest, TResponse>` interface with HTTP request handling.

**Key features:**
- IR to provider request conversion
- HTTP request execution with authentication
- SSE/JSONL streaming support
- Error handling with proper error types
- Optional: health check, cost estimation, model listing

**Example providers:** OpenAI, Anthropic, Gemini, Ollama, Groq, DeepSeek, Mistral

**Estimated time:** 3-6 hours for complete implementation with tests

### 4. Backend Native Adapter Creator (`create-backend-native-adapter.md`)

**Use when:** Creating a backend adapter for local inference using native libraries or frameworks.

**What you'll create:** A TypeScript class that implements `BackendAdapter` with local model execution instead of HTTP calls.

**Key features:**
- Dynamic library loading (optional dependencies)
- Initialization and model loading
- Resource management and cleanup
- Platform compatibility checks
- Callback or generator-based streaming

**Example frameworks:** node-llamacpp, Transformers.js, ONNX Runtime, TensorFlow.js, Apple Foundation Models

**Estimated time:** 4-8 hours for complete implementation with tests

### 5. Wrapper Creator (`create-wrapper.md`)

**Use when:** Creating a wrapper to provide a familiar API surface on top of backend adapters.

**What you'll create:** A TypeScript class or function that wraps a `BackendAdapter` and provides an SDK-like, browser API-like, or proxy-based interface.

**Key features:**
- SDK wrapper (OpenAI, Anthropic style)
- Browser API wrapper (Chrome AI style)
- Proxy wrapper (Anymethod style)
- Framework integration (Vercel AI SDK, LangChain)
- Conversation history management
- Token tracking

**Example wrappers:** OpenAI SDK, Anthropic SDK, Chrome AI, Anymethod

**Estimated time:** 2-5 hours for complete implementation with tests

## How to Use These Skills

### For Claude (AI Assistant)

When a user asks to create a new adapter or wrapper:

1. **Identify the type** - Determine which skill to use based on what the user wants to create
2. **Gather prerequisites** - Ask the user for the required information listed in each skill
3. **Follow the step-by-step guide** - Implement each section in order
4. **Use the checklists** - Verify all requirements are met before completion
5. **Reference examples** - Study the listed reference adapters for patterns

### For Developers

When creating a new adapter or wrapper manually:

1. **Read the appropriate skill** - Open the skill file for the type you want to create
2. **Review prerequisites** - Gather all required information about the provider/API
3. **Study reference examples** - Look at the existing adapters mentioned in the skill
4. **Follow the implementation steps** - Complete each section systematically
5. **Run tests** - Use the provided test templates
6. **Submit** - Follow the checklist before submitting your PR

## Skill Contents Overview

Each skill contains:

- **Prerequisites** - Information needed before starting
- **Step-by-step implementation** - Detailed code examples for each section
- **Type definitions** - Complete TypeScript types for the adapter/wrapper
- **Common patterns** - Reusable code patterns and best practices
- **Error handling** - Proper error types and handling strategies
- **Streaming support** - SSE, JSONL, or generator patterns
- **Testing templates** - Example test structures
- **Checklist** - Verification list before completion
- **Reference examples** - Existing adapters to study

## Architecture Context

### Frontend Adapter Flow

```
Provider Request → Frontend.toIR() → IR Request
IR Response → Frontend.fromIR() → Provider Response
IR Stream → Frontend.fromIRStream() → Provider Stream
```

### Backend Adapter Flow

```
IR Request → Backend.fromIR() → Provider Request
→ HTTP Request (or local execution)
→ Provider Response → Backend.toIR() → IR Response
```

### Wrapper Flow

```
Wrapper API → Convert to IR → Backend.execute() → IR Response
→ Convert to Wrapper Format → Return to User
```

## Key Concepts

### Universal IR (Intermediate Representation)

The core abstraction that all adapters convert to/from:

```typescript
interface IRChatRequest {
  messages: IRMessage[];
  parameters?: {
    model?: string;
    temperature?: number;
    topP?: number;
    topK?: number;
    maxTokens?: number;
    // ...
  };
  stream: boolean;
  metadata: IRMetadata;
}

interface IRChatResponse {
  message: IRMessage;
  finishReason: FinishReason;
  usage?: IRUsage;
  metadata: IRMetadata;
}
```

### System Message Strategies

Different providers handle system messages differently:

- `'in-messages'` - System messages in the messages array (OpenAI, Ollama)
- `'separate-parameter'` - System extracted to separate field (Anthropic, Gemini)
- `'prepend-user'` - System prepended to first user message (some legacy APIs)
- `'not-supported'` - System messages not supported (drop them)

Use `normalizeSystemMessages()` utility in backend adapters to handle this automatically.

### Streaming Modes

Two streaming modes supported:

- **Delta mode** - Only deltas in each chunk (most efficient)
- **Accumulated mode** - Full text so far in each chunk (easier to use)

Use `getEffectiveStreamMode()` and `mergeStreamingConfig()` utilities to support both.

### Error Types

Use specific error classes:

- `AdapterConversionError` - Format conversion failures
- `NetworkError` - HTTP/network issues
- `ProviderError` - Provider API errors (auth, rate limit, etc.)
- `StreamError` - Streaming-specific errors
- `ValidationError` - Invalid input
- `AdapterError` - General adapter errors

## File Structure

```
src/
├── adapters/
│   ├── frontend/          # Frontend adapters
│   │   ├── openai.ts
│   │   ├── anthropic.ts
│   │   └── index.ts
│   ├── backend/           # HTTP backend adapters
│   │   ├── openai.ts
│   │   ├── anthropic.ts
│   │   └── index.ts
│   └── backend-native/    # Native backend adapters
│       ├── node-llamacpp.ts
│       ├── apple.ts
│       └── index.ts
└── wrappers/              # Wrappers
    ├── openai-sdk.ts
    ├── anymethod.ts
    └── index.ts
```

## Testing

All adapters and wrappers should have comprehensive tests:

```
tests/
├── adapters/
│   ├── frontend/
│   │   └── provider.test.ts
│   ├── backend/
│   │   └── provider.test.ts
│   └── backend-native/
│       └── framework.test.ts
└── wrappers/
    └── wrapper.test.ts
```

Test coverage should include:
- Type conversions (to/from IR)
- Parameter mapping
- Streaming behavior
- Error handling
- Edge cases

## Documentation

After creating an adapter or wrapper, update:

1. **README.md** - Add to supported providers table
2. **docs/API.md** - Add API documentation
3. **EXAMPLES.md** - Create usage examples
4. **CHANGELOG.md** - Document the addition

## Contributing

When submitting a new adapter or wrapper:

1. Follow the appropriate skill guide
2. Complete the checklist
3. Write tests (80%+ coverage)
4. Add documentation
5. Create examples
6. Update exports in index.ts
7. Submit PR with description

## Common Issues & Solutions

### Issue: System messages not handled correctly

**Solution:** Use `normalizeSystemMessages()` utility in backend adapters:

```typescript
const { messages, systemParameter } = normalizeSystemMessages(
  request.messages,
  this.metadata.capabilities.systemMessageStrategy,
  this.metadata.capabilities.supportsMultipleSystemMessages
);
```

### Issue: Streaming not working

**Solution:** Check these common problems:
- Response body exists before reading
- SSE format parsing (look for "data: " prefix)
- JSONL format parsing (split by newlines)
- Proper chunk sequencing
- Error chunk yielding

### Issue: Temperature out of range

**Solution:** Normalize temperature based on provider:

```typescript
// IR uses 0-2, some providers use 0-1
private normalizeTemperature(temp?: number): number | undefined {
  if (temp === undefined) return undefined;
  return Math.min(Math.max(temp / 2, 0), 1);  // Scale to 0-1
}
```

### Issue: Optional dependency not found

**Solution:** Use dynamic imports with clear error messages:

```typescript
async function loadLibrary() {
  try {
    return await import('optional-library');
  } catch (error) {
    throw new AdapterError({
      message: 'Install library: npm install optional-library\nDocs: https://...',
      // ...
    });
  }
}
```

## Support

- **Questions**: Open a discussion on GitHub
- **Bugs**: Open an issue with reproduction steps
- **Help**: Reference existing adapters as examples

## Resources

- **Type Definitions**: `src/types/adapters.ts`, `src/types/ir.ts`
- **Utilities**: `src/utils/`
- **Error Classes**: `src/errors/`
- **Examples**: `examples/` directory
- **Tests**: `tests/` directory

---

**Made with ❤️ for the AI community**
