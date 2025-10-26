# Backend Native Adapter Creator Skill

Use this skill when the user asks to create a new backend native adapter for ai.matey. Native adapters execute inference locally using native bindings/frameworks instead of HTTP APIs.

## Prerequisites

Before starting, gather this information from the user:
1. **Runtime/Framework name** (e.g., "Transformers.js", "ONNX Runtime", "TensorFlow.js")
2. **NPM package name** (e.g., "@xenova/transformers", "onnxruntime-node")
3. **Platform requirements** (Node.js only, browser compatible, OS-specific)
4. **Model format** (GGUF, ONNX, SafeTensors, etc.)
5. **Initialization requirements** (model loading, context creation)
6. **Streaming support** (callback-based, generator-based, or not supported)
7. **Sample code** from the library's documentation

## Key Differences from HTTP Adapters

1. **No HTTP requests** - Direct library integration
2. **Initialization required** - Must load models/create contexts before use
3. **Optional dependencies** - Use dynamic imports for peer dependencies
4. **Resource management** - Clean up models, contexts, sessions
5. **Platform checks** - Verify OS/runtime compatibility

## Step-by-Step Implementation

### Step 1: Create the adapter file

Create `src/adapters/backend-native/{framework-name}.ts` (lowercase, hyphenated).

Example: `src/adapters/backend-native/transformers-js.ts`

### Step 2: Import dependencies and define types

```typescript
/**
 * {Framework} Backend Adapter
 *
 * Local inference using {Framework}.
 *
 * Node.js only / Browser compatible / macOS only (adjust as needed)
 *
 * @module
 */

import type { BackendAdapter, BackendAdapterConfig, AdapterMetadata } from '../../types/adapters.js';
import type {
  IRChatRequest,
  IRChatResponse,
  IRChatStream,
  IRMessage,
  IRStreamChunk,
} from '../../types/ir.js';
import {
  AdapterError,
  ProviderError,
  ErrorCode,
} from '../../errors/index.js';

// ============================================================================
// Dynamic Import for Optional Dependency
// ============================================================================

// Library will be loaded dynamically to avoid hard dependency
let nativeLibrary: any;

/**
 * Load the native library dynamically.
 * Throws error with installation instructions if not found.
 */
async function loadLibrary() {
  if (!nativeLibrary) {
    try {
      // @ts-ignore - Optional peer dependency
      nativeLibrary = await import('package-name');
    } catch (error) {
      throw new AdapterError({
        code: ErrorCode.PROVIDER_ERROR,
        message:
          'Failed to load {Framework}. Install it with: npm install package-name\n' +
          'Documentation: https://...',
        provenance: { backend: '{framework-lowercase}-backend' },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }
  return nativeLibrary;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration specific to {Framework} adapter.
 */
export interface {Framework}Config extends BackendAdapterConfig {
  /**
   * Path to model file (for local models).
   */
  modelPath?: string;

  /**
   * Model name or identifier (for auto-download).
   */
  modelName?: string;

  /**
   * Maximum context size.
   */
  contextSize?: number;

  /**
   * Number of GPU layers (if supported).
   */
  gpuLayers?: number;

  // ... framework-specific options
}
```

### Step 3: Create adapter class with initialization

```typescript
// ============================================================================
// {Framework} Backend Adapter
// ============================================================================

export class {Framework}BackendAdapter implements BackendAdapter<IRChatRequest, IRChatResponse> {
  readonly metadata: AdapterMetadata;
  private readonly config: {Framework}Config;
  private initialized: boolean = false;

  // Framework-specific state
  private model: any;
  private context: any;

  constructor(config: {Framework}Config) {
    this.config = config;

    // Platform check if needed
    this.checkPlatformCompatibility();

    this.metadata = {
      name: '{framework-lowercase}-backend',
      version: '1.0.0',
      provider: '{Framework}',
      capabilities: {
        streaming: true,  // Based on framework support
        multiModal: false,
        tools: false,
        maxContextTokens: config.contextSize || 4096,

        systemMessageStrategy: 'in-messages',  // Usually pass through IR
        supportsMultipleSystemMessages: true,

        supportsTemperature: true,
        supportsTopP: true,
        supportsTopK: true,
        supportsSeed: true,
        supportsFrequencyPenalty: false,
        supportsPresencePenalty: false,
        maxStopSequences: 0,  // Often not supported in local models
      },
      config: {
        modelPath: config.modelPath,
        contextSize: config.contextSize,
      },
    };
  }

  /**
   * Check if the current platform is compatible.
   * Throw error if not.
   */
  private checkPlatformCompatibility(): void {
    // Example: Check for macOS
    if (process.platform !== 'darwin') {
      throw new AdapterError({
        code: ErrorCode.PROVIDER_ERROR,
        message: '{Framework} is only supported on macOS',
        provenance: { backend: this.metadata.name },
      });
    }

    // Example: Check for Node.js version
    const nodeVersion = process.versions.node;
    const majorVersion = parseInt(nodeVersion.split('.')[0], 10);
    if (majorVersion < 18) {
      throw new AdapterError({
        code: ErrorCode.PROVIDER_ERROR,
        message: '{Framework} requires Node.js 18 or higher',
        provenance: { backend: this.metadata.name },
      });
    }

    // Example: Check for Apple Silicon
    if (process.arch !== 'arm64') {
      throw new AdapterError({
        code: ErrorCode.PROVIDER_ERROR,
        message: '{Framework} requires Apple Silicon (arm64)',
        provenance: { backend: this.metadata.name },
      });
    }
  }

  /**
   * Initialize the adapter.
   * Must be called before execute() or executeStream().
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Load library
      const lib = await loadLibrary();

      // Load model
      if (this.config.modelPath) {
        // Load from file
        this.model = await lib.loadModel(this.config.modelPath, {
          contextSize: this.config.contextSize,
          gpuLayers: this.config.gpuLayers,
        });
      } else if (this.config.modelName) {
        // Auto-download
        this.model = await lib.loadModel(this.config.modelName);
      } else {
        throw new AdapterError({
          code: ErrorCode.PROVIDER_ERROR,
          message: 'Either modelPath or modelName must be provided',
          provenance: { backend: this.metadata.name },
        });
      }

      // Create context/session if needed
      this.context = await this.model.createContext({
        maxTokens: this.config.contextSize || 4096,
      });

      this.initialized = true;

    } catch (error) {
      throw new ProviderError({
        code: ErrorCode.PROVIDER_ERROR,
        message: `Initialization failed: ${error instanceof Error ? error.message : String(error)}`,
        isRetryable: false,
        provenance: { backend: this.metadata.name },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Clean up resources.
   */
  async cleanup(): Promise<void> {
    if (this.context) {
      await this.context.dispose?.();
      this.context = null;
    }
    if (this.model) {
      await this.model.dispose?.();
      this.model = null;
    }
    this.initialized = false;
  }
```

### Step 4: Implement fromIR() and toIR()

Since native adapters work directly with IR, these are often simplified:

```typescript
  /**
   * Convert IR to native format.
   * Often passthrough for native adapters.
   */
  public fromIR(request: IRChatRequest): IRChatRequest {
    // Some frameworks need IR directly
    return request;

    // Or minimal conversion if framework has specific format:
    // return {
    //   messages: request.messages,
    //   options: {
    //     temperature: request.parameters?.temperature,
    //     maxTokens: request.parameters?.maxTokens,
    //   }
    // };
  }

  /**
   * Convert native response to IR.
   * Often passthrough for native adapters.
   */
  public toIR(
    response: IRChatResponse,
    _originalRequest: IRChatRequest,
    _latencyMs: number
  ): IRChatResponse {
    return response;
  }
```

### Step 5: Implement execute() - Non-Streaming

```typescript
  async execute(request: IRChatRequest, _signal?: AbortSignal): Promise<IRChatResponse> {
    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const startTime = Date.now();

      // Convert messages to prompt format
      const prompt = this.formatPrompt(request.messages);

      // Generate completion
      const result = await this.model.generate(prompt, {
        temperature: request.parameters?.temperature || 0.7,
        maxTokens: request.parameters?.maxTokens || 1024,
        topP: request.parameters?.topP,
        topK: request.parameters?.topK,
        seed: request.parameters?.seed,
      });

      // Build IR response
      const message: IRMessage = {
        role: 'assistant',
        content: result.text,
      };

      const latencyMs = Date.now() - startTime;

      return {
        message,
        finishReason: result.stopReason || 'stop',
        usage: result.usage ? {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
        } : undefined,
        metadata: {
          ...request.metadata,
          provenance: {
            ...request.metadata.provenance,
            backend: this.metadata.name,
          },
          custom: {
            ...request.metadata.custom,
            latencyMs,
          },
        },
      };

    } catch (error) {
      throw new ProviderError({
        code: ErrorCode.PROVIDER_ERROR,
        message: `Generation failed: ${error instanceof Error ? error.message : String(error)}`,
        isRetryable: false,
        provenance: { backend: this.metadata.name },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Format messages into a prompt string.
   * Most local models expect a formatted prompt.
   */
  private formatPrompt(messages: IRMessage[]): string {
    // Example: ChatML format
    let prompt = '';

    for (const message of messages) {
      const content = typeof message.content === 'string'
        ? message.content
        : message.content.map(c => c.type === 'text' ? c.text : '').join('');

      if (message.role === 'system') {
        prompt += `<|im_start|>system\n${content}<|im_end|>\n`;
      } else if (message.role === 'user') {
        prompt += `<|im_start|>user\n${content}<|im_end|>\n`;
      } else if (message.role === 'assistant') {
        prompt += `<|im_start|>assistant\n${content}<|im_end|>\n`;
      }
    }

    // Add final assistant prompt
    prompt += '<|im_start|>assistant\n';

    return prompt;

    // Alternative: Llama format
    // return messages.map(m => {
    //   const content = typeof m.content === 'string' ? m.content : '';
    //   if (m.role === 'system') return `<<SYS>>${content}<</SYS>>`;
    //   if (m.role === 'user') return `[INST]${content}[/INST]`;
    //   return content;
    // }).join('\n');
  }
```

### Step 6: Implement executeStream() - Streaming

Different frameworks have different streaming mechanisms:

#### Pattern A: Callback-Based Streaming

```typescript
  async *executeStream(request: IRChatRequest, _signal?: AbortSignal): IRChatStream {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      let sequence = 0;

      // Yield start chunk
      yield {
        type: 'start',
        sequence: sequence++,
        metadata: {
          ...request.metadata,
          provenance: {
            ...request.metadata.provenance,
            backend: this.metadata.name,
          },
        },
      } as IRStreamChunk;

      const prompt = this.formatPrompt(request.messages);
      let fullContent = '';

      // Create a promise-based queue for callback streaming
      const queue: IRStreamChunk[] = [];
      let resolveNext: (() => void) | null = null;
      let done = false;
      let error: Error | null = null;

      // Start generation with callback
      this.model.generate(prompt, {
        temperature: request.parameters?.temperature,
        maxTokens: request.parameters?.maxTokens,
        onToken: (token: string) => {
          fullContent += token;

          queue.push({
            type: 'content',
            sequence: sequence++,
            delta: token,
            role: 'assistant',
          });

          if (resolveNext) {
            resolveNext();
            resolveNext = null;
          }
        },
        onComplete: (result: any) => {
          queue.push({
            type: 'done',
            sequence: sequence++,
            finishReason: 'stop',
            message: { role: 'assistant', content: fullContent },
            usage: result.usage,
          });
          done = true;

          if (resolveNext) {
            resolveNext();
            resolveNext = null;
          }
        },
        onError: (err: Error) => {
          error = err;
          done = true;

          if (resolveNext) {
            resolveNext();
            resolveNext = null;
          }
        },
      });

      // Yield chunks as they arrive
      while (!done || queue.length > 0) {
        if (queue.length > 0) {
          const chunk = queue.shift()!;
          yield chunk;
        } else if (!done) {
          await new Promise<void>(resolve => {
            resolveNext = resolve;
          });
        }
      }

      if (error) {
        throw error;
      }

    } catch (err) {
      yield {
        type: 'error',
        sequence: 0,
        error: {
          code: err instanceof Error ? err.name : 'UNKNOWN_ERROR',
          message: err instanceof Error ? err.message : String(err),
        },
      } as IRStreamChunk;
    }
  }
```

#### Pattern B: Generator-Based Streaming

```typescript
  async *executeStream(request: IRChatRequest, _signal?: AbortSignal): IRChatStream {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      let sequence = 0;

      yield {
        type: 'start',
        sequence: sequence++,
        metadata: {
          ...request.metadata,
          provenance: {
            ...request.metadata.provenance,
            backend: this.metadata.name,
          },
        },
      } as IRStreamChunk;

      const prompt = this.formatPrompt(request.messages);
      let fullContent = '';

      // If library provides an async generator
      const stream = this.model.generateStream(prompt, {
        temperature: request.parameters?.temperature,
        maxTokens: request.parameters?.maxTokens,
      });

      for await (const token of stream) {
        fullContent += token;

        yield {
          type: 'content',
          sequence: sequence++,
          delta: token,
          role: 'assistant',
        } as IRStreamChunk;
      }

      yield {
        type: 'done',
        sequence: sequence++,
        finishReason: 'stop',
        message: { role: 'assistant', content: fullContent },
      } as IRStreamChunk;

    } catch (err) {
      yield {
        type: 'error',
        sequence: 0,
        error: {
          code: err instanceof Error ? err.name : 'UNKNOWN_ERROR',
          message: err instanceof Error ? err.message : String(err),
        },
      } as IRStreamChunk;
    }
  }
```

### Step 7: Implement Optional Methods

```typescript
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      return this.model != null;
    } catch {
      return false;
    }
  }

  async estimateCost(_request: IRChatRequest): Promise<number | null> {
    // Local inference is free
    return 0;
  }

  async listModels(_options?: ListModelsOptions): Promise<ListModelsResult> {
    // Return available models
    return {
      models: [
        {
          id: this.config.modelName || 'local-model',
          name: this.config.modelName || 'Local Model',
          provider: this.metadata.provider,
          contextWindow: this.config.contextSize || 4096,
          capabilities: {
            streaming: this.metadata.capabilities.streaming,
            functionCalling: false,
            vision: false,
          },
        },
      ],
      provider: this.metadata.provider,
    };
  }
}
```

### Step 8: Export the adapter

Add to `src/adapters/backend-native/index.ts`:

```typescript
// {Framework} backend adapter
export {
  {Framework}BackendAdapter,
  type {Framework}Config,
} from './{framework-lowercase}.js';
```

### Step 9: Document installation requirements

Create or update `docs/NATIVE_BACKENDS.md`:

```markdown
## {Framework}

**Platform**: Node.js only / Browser compatible / macOS only

**Installation**:
```bash
npm install package-name
```

**Requirements**:
- Node.js 18+
- macOS 13+ (Apple Silicon)
- 8GB RAM minimum

**Usage**:
```typescript
import { {Framework}BackendAdapter } from 'ai.matey/adapters/backend-native';

const backend = new {Framework}BackendAdapter({
  modelPath: './models/model.gguf',
  contextSize: 4096,
  gpuLayers: 32,
});

await backend.initialize();

const response = await backend.execute({
  messages: [{ role: 'user', content: 'Hello!' }],
  parameters: { temperature: 0.7 },
  metadata: { requestId: '...', timestamp: Date.now(), provenance: {} }
});

// Clean up when done
await backend.cleanup();
```
```

## Common Patterns & Best Practices

### 1. Graceful Dependency Loading

```typescript
async function loadLibrary() {
  if (!nativeLibrary) {
    try {
      nativeLibrary = await import('package-name');
    } catch (error) {
      const installCommand = 'npm install package-name';
      const docsURL = 'https://...';

      throw new AdapterError({
        code: ErrorCode.PROVIDER_ERROR,
        message:
          `Failed to load {Framework}.\n\n` +
          `Install: ${installCommand}\n` +
          `Docs: ${docsURL}\n\n` +
          `Error: ${error.message}`,
        provenance: { backend: '{framework}-backend' },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }
  return nativeLibrary;
}
```

### 2. Platform-Specific Code Paths

```typescript
private async loadModelOptimized() {
  if (process.platform === 'darwin' && process.arch === 'arm64') {
    // Use Metal acceleration on Apple Silicon
    return await this.loadModelMetal();
  } else if (process.platform === 'linux') {
    // Use CUDA on Linux
    return await this.loadModelCUDA();
  } else {
    // CPU fallback
    return await this.loadModelCPU();
  }
}
```

### 3. Resource Cleanup

```typescript
private async cleanupResources() {
  const resources = [this.context, this.model, this.session];

  for (const resource of resources) {
    try {
      await resource?.dispose?.();
    } catch (error) {
      console.warn('Failed to dispose resource:', error);
    }
  }
}

// Use in both cleanup() and destructor
async cleanup() {
  await this.cleanupResources();
  this.initialized = false;
}
```

### 4. Model Format Detection

```typescript
private detectModelFormat(path: string): 'gguf' | 'onnx' | 'safetensors' {
  const ext = path.toLowerCase().split('.').pop();

  switch (ext) {
    case 'gguf':
      return 'gguf';
    case 'onnx':
      return 'onnx';
    case 'safetensors':
      return 'safetensors';
    default:
      throw new AdapterError({
        code: ErrorCode.PROVIDER_ERROR,
        message: `Unsupported model format: ${ext}`,
        provenance: { backend: this.metadata.name },
      });
  }
}
```

## Checklist

Before submitting the adapter, verify:

- [ ] Dynamic import for optional dependency
- [ ] Clear installation instructions in error messages
- [ ] Platform compatibility check in constructor
- [ ] initialize() method implemented
- [ ] cleanup() method implemented for resource disposal
- [ ] fromIR() and toIR() implemented (even if passthrough)
- [ ] execute() handles model loading
- [ ] executeStream() handles callback or generator streaming
- [ ] Prompt formatting appropriate for model family
- [ ] Error handling with proper error types
- [ ] Tests with mocked library
- [ ] Documentation in NATIVE_BACKENDS.md
- [ ] Exported in index.ts
- [ ] JSDoc comments complete

## Example Reference Adapters

Study these existing native adapters:

- **Process-based**: `src/adapters/backend-native/node-llamacpp.ts` - Subprocess streaming
- **Platform-specific**: `src/adapters/backend-native/apple.ts` - macOS only, Swift integration

## Next Steps

After creating the native adapter:

1. **Peer dependency** - Add to package.json peerDependencies
2. **Documentation** - Add to README and NATIVE_BACKENDS.md
3. **Platform tests** - Test on target platforms
4. **Examples** - Create local inference examples
5. **Performance tuning** - Optimize for target hardware
