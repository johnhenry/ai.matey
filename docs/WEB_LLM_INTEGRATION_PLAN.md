# Web-LLM & MLC-LLM Integration Plan

**Status:** Planning Phase
**Target Version:** v0.2.0
**Complexity:** High (4-6 weeks)
**Priority:** HIGH - Enables browser-native LLM execution

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Required Primitives](#required-primitives)
4. [Learnings from Existing Adapters](#learnings-from-existing-adapters)
5. [Implementation Phases](#implementation-phases)
6. [Technical Design](#technical-design)
7. [API Specifications](#api-specifications)
8. [Challenges & Solutions](#challenges--solutions)
9. [Testing Strategy](#testing-strategy)
10. [Success Metrics](#success-metrics)

---

## Executive Summary

### What is web-llm / mlc-llm?

**web-llm:**
- Browser-based LLM runtime using WebGPU
- Runs models entirely client-side (no server needed)
- OpenAI-compatible chat API
- Models: Llama 3, Phi 3, Gemma, Mistral, Qwen families
- Size: ~1-8GB per model (quantized)

**mlc-llm:**
- Machine Learning Compilation framework
- Compiles models for efficient execution
- Backend for web-llm (provides compiled models)
- Can run on mobile, web, desktop, server

### Integration Goals

1. **Backend Adapter** - Primary integration point
   - Enable browser-native LLM execution via web-llm
   - Zero server costs for inference
   - Privacy-preserving (data never leaves browser)
   - Offline capability

2. **Router Integration** - Seamless fallback
   - Route between cloud providers and local browser models
   - Fallback to web-llm when offline
   - Cost optimization (use free local models when possible)

3. **React Hooks Enhancement** - UI integration
   - Progress tracking for model downloads
   - Model management UI components
   - Storage quota management

### Value Proposition

**For ai.matey:**
- ✅ Unique differentiator (browser-native LLM execution)
- ✅ Cost optimization (free inference after model download)
- ✅ Privacy-first option (no data sent to servers)
- ✅ Offline-capable applications
- ✅ Complements existing cloud provider adapters

**For Developers:**
- Easy fallback from cloud → browser models
- Unified API (same code works for OpenAI and web-llm)
- Progressive enhancement (cloud-first, browser as backup)
- Cost reduction for high-volume applications

---

## Architecture Overview

### Current ai.matey Architecture

```
┌─────────────────┐
│ Frontend Apps   │ (React, Next.js, etc.)
└────────┬────────┘
         │
         v
┌─────────────────┐
│ React Hooks     │ (useChat, useCompletion, useObject)
│ - useChat       │
│ - useCompletion │
│ - useObject     │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Bridge          │ (middleware, routing)
│ - Middleware    │
│ - Router        │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Backend         │ (adapters to AI providers)
│ Adapters        │
│ - OpenAI        │
│ - Anthropic     │
│ - Gemini        │
│ - Ollama        │ ← Similar to web-llm
│ - Chrome AI     │ ← Browser-based (similar)
└─────────────────┘
```

### Proposed web-llm Integration

```
┌─────────────────────────────────────────────┐
│ Browser Application                         │
│                                             │
│ ┌─────────────────┐                        │
│ │ React Hooks     │                        │
│ │ - useChat       │                        │
│ │ - useWebLLM ←── NEW (model management)   │
│ └────────┬────────┘                        │
│          │                                  │
│          v                                  │
│ ┌─────────────────┐                        │
│ │ Bridge/Router   │                        │
│ │ - Route logic   │                        │
│ │ - Fallback      │                        │
│ └────────┬────────┘                        │
│          │                                  │
│          v                                  │
│ ┌──────────────────────────────────┐      │
│ │ WebLLM Backend Adapter    ←── NEW │      │
│ │ - Model loading           │      │      │
│ │ - Chat completions        │      │      │
│ │ - Progress tracking       │      │      │
│ │ - Storage management      │      │      │
│ └────────┬───────────────────┘      │      │
│          │                           │      │
│          v                           │      │
│ ┌──────────────────────────────┐   │      │
│ │ web-llm SDK                  │   │      │
│ │ - MLCEngine                  │   │      │
│ │ - WebGPU execution           │   │      │
│ │ - Model caching (IndexedDB)  │   │      │
│ └──────────────────────────────┘   │      │
└─────────────────────────────────────────────┘
```

---

## Required Primitives

### 1. Core Primitives (Backend Adapter)

#### Model Management
```typescript
interface WebLLMModelInfo {
  model_id: string;           // e.g., "Llama-3.1-8B-Instruct-q4f32_1"
  model_url: string;          // Download URL
  model_lib_url: string;      // WebAssembly library URL
  vram_required_MB: number;   // Memory requirement
  low_resource_required: boolean;
  required_features: string[]; // ['WebGPU']
  size_MB: number;            // Total download size
}

interface ModelStatus {
  downloaded: boolean;
  loading: boolean;
  loaded: boolean;
  progress: number;           // 0-100
  error?: Error;
}

// Methods needed:
- listAvailableModels(): Promise<WebLLMModelInfo[]>
- getModelStatus(modelId: string): Promise<ModelStatus>
- downloadModel(modelId: string, onProgress: ProgressCallback): Promise<void>
- loadModel(modelId: string): Promise<void>
- unloadModel(modelId: string): Promise<void>
- deleteModel(modelId: string): Promise<void>
```

#### Runtime Checks
```typescript
interface RuntimeCapabilities {
  webGPUAvailable: boolean;
  webGPUVersion?: string;
  maxMemoryMB: number;
  supportedModels: string[];
  browserCompatible: boolean;
}

// Methods needed:
- checkWebGPUAvailability(): Promise<boolean>
- getDeviceCapabilities(): Promise<RuntimeCapabilities>
- estimateMaxModelSize(): Promise<number>
```

#### Chat Completions (OpenAI-compatible)
```typescript
interface ChatCompletionRequest {
  messages: Message[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  seed?: number;
}

interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: Message;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Methods needed:
- createChatCompletion(request): Promise<ChatCompletionResponse>
- createChatCompletionStream(request): AsyncGenerator<ChatCompletionChunk>
```

#### Progress Tracking
```typescript
interface ProgressUpdate {
  phase: 'downloading' | 'loading' | 'initializing' | 'ready';
  progress: number;        // 0-100
  text: string;           // Human-readable status
  timeElapsed: number;    // ms
  timeRemaining?: number; // ms
}

type ProgressCallback = (update: ProgressUpdate) => void;

// Integration with existing telemetry middleware
- reportProgress(update: ProgressUpdate): void
- onDownloadProgress(callback: ProgressCallback): void
- onLoadProgress(callback: ProgressCallback): void
```

#### Storage Management
```typescript
interface StorageInfo {
  used: number;           // bytes used
  quota: number;          // total quota
  available: number;      // bytes available
  models: Array<{
    id: string;
    size: number;
    lastUsed: Date;
  }>;
}

// Methods needed:
- getStorageInfo(): Promise<StorageInfo>
- clearCache(): Promise<void>
- evictLeastRecentlyUsed(targetSizeMB: number): Promise<void>
```

### 2. React Hooks Primitives

#### useWebLLM Hook
```typescript
interface UseWebLLMOptions {
  modelId: string;
  autoLoad?: boolean;
  onProgress?: ProgressCallback;
}

interface UseWebLLMReturn {
  // Model state
  isAvailable: boolean;
  isDownloaded: boolean;
  isLoading: boolean;
  isLoaded: boolean;
  progress: number;
  error: Error | null;

  // Actions
  download: () => Promise<void>;
  load: () => Promise<void>;
  unload: () => Promise<void>;
  remove: () => Promise<void>;

  // Storage
  storageInfo: StorageInfo | null;
  clearCache: () => Promise<void>;

  // Chat (same as useChat but with web-llm backend)
  // Inherits from useChat
}

// Usage:
const {
  isLoaded,
  isDownloaded,
  progress,
  download,
  load,
  messages,
  input,
  handleSubmit
} = useWebLLM({
  modelId: 'Llama-3.1-8B-Instruct-q4f32_1',
  autoLoad: true,
  onProgress: (update) => console.log(update.text)
});
```

#### useModelManager Hook
```typescript
interface UseModelManagerReturn {
  models: WebLLMModelInfo[];
  downloadedModels: string[];
  isLoading: boolean;

  // Actions
  downloadModel: (id: string) => Promise<void>;
  deleteModel: (id: string) => Promise<void>;
  refresh: () => Promise<void>;

  // Storage
  storage: StorageInfo;
  canDownload: (modelId: string) => boolean;
}
```

### 3. Router Primitives

#### Fallback Strategy
```typescript
interface WebLLMRoutingStrategy {
  // Try web-llm first if model is loaded
  preferLocal?: boolean;

  // Fallback to cloud if web-llm fails
  cloudFallback?: boolean;

  // Use web-llm only when offline
  offlineOnly?: boolean;

  // Criteria for using web-llm
  criteria?: {
    maxLatency?: number;      // Use cloud if web-llm slower
    maxCostPerToken?: number; // Use web-llm if cost too high
    requiresPrivacy?: boolean;// Always use web-llm for sensitive
  };
}
```

### 4. Middleware Primitives

#### Progress Telemetry Middleware
```typescript
interface ProgressTelemetryConfig {
  reportInterval?: number;   // ms between reports
  includeNetworkStats?: boolean;
  onProgress?: ProgressCallback;
}

// Extends existing telemetry middleware
- trackModelDownload(modelId: string, progress: number): void
- trackModelLoad(modelId: string, duration: number): void
- trackMemoryUsage(bytes: number): void
```

---

## Learnings from Existing Adapters

### 1. Chrome AI Backend Adapter

**Similarities to web-llm:**
- ✅ Browser-only execution
- ✅ Runtime availability checks
- ✅ No API key needed
- ✅ Streaming-first design

**Key Patterns to Reuse:**
```typescript
// 1. Browser environment detection
function getWindow(): Window | undefined {
  return typeof globalThis !== 'undefined' && 'window' in globalThis
    ? (globalThis as any).window
    : undefined;
}

// 2. Runtime availability check (async)
async function checkWebLLMAvailability(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!navigator.gpu) return false;

  try {
    const adapter = await navigator.gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

// 3. Capability reporting
metadata: {
  capabilities: {
    streaming: true,
    multiModal: false,
    tools: false,        // web-llm supports this!
    supportsTemperature: true,
    // ... etc
  }
}

// 4. Passthrough or minimal IR conversion
fromIR(request: IRChatRequest): IRChatRequest {
  // web-llm uses OpenAI format, might be passthrough
  return request;
}
```

### 2. Ollama Backend Adapter

**Similarities to web-llm:**
- ✅ Local execution
- ✅ Model management (list, pull, delete)
- ✅ Health checks
- ✅ Streaming support

**Key Patterns to Reuse:**
```typescript
// 1. Model listing
async listModels(): Promise<AIModel[]> {
  const response = await fetch(`${baseURL}/api/tags`);
  const data = await response.json();
  return data.models.map(transformModel);
}

// 2. Health check
async healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${baseURL}/api/version`);
    return response.ok;
  } catch {
    return false;
  }
}

// 3. Streaming with ReadableStream
async *executeStream(request): AsyncGenerator<IRStreamChunk> {
  const response = await fetch(url, { body, stream: true });
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      // Parse and yield chunks
    }
  } finally {
    reader.releaseLock();
  }
}
```

### 3. OpenAI Backend Adapter

**Similarities to web-llm:**
- ✅ OpenAI-compatible API format
- ✅ Tool calling support (web-llm has this!)
- ✅ Streaming chunks format

**Key Patterns to Reuse:**
```typescript
// 1. Message conversion (web-llm uses same format)
convertMessageToOpenAI(msg: IRMessage): OpenAIMessage {
  // Likely can use directly for web-llm
}

// 2. Streaming chunk parsing
// web-llm returns OpenAI-format chunks
async *executeStream() {
  for await (const chunk of engine.chat.completions.create({
    messages,
    stream: true
  })) {
    yield {
      type: 'content',
      sequence,
      delta: chunk.choices[0]?.delta?.content || '',
      accumulated: accumulatedContent,
    };
  }
}

// 3. Tool call handling
// web-llm supports function calling!
if (chunk.choices[0]?.delta?.tool_calls) {
  // Handle tool calls (same as OpenAI)
}
```

### 4. Structured Output (Zod Integration)

**Applicable to web-llm:**
- ✅ web-llm supports JSON mode
- ✅ Can use same `generateObject()` logic
- ✅ Schema validation works same way

**Key Patterns to Reuse:**
```typescript
// 1. Schema conversion
const jsonSchema = convertZodToJsonSchema(zodSchema);

// 2. Send to web-llm with JSON mode
const response = await engine.chat.completions.create({
  messages,
  response_format: { type: 'json_object' },
  // Add schema to system message
});

// 3. Validate with Zod
const result = zodSchema.parse(JSON.parse(response));
```

### 5. OpenTelemetry Middleware

**Applicable to web-llm:**
- ✅ Track model download progress
- ✅ Monitor memory usage
- ✅ Trace inference latency
- ✅ Report WebGPU metrics

**Key Patterns to Reuse:**
```typescript
// 1. Optional peer dependency pattern
let webLLM: any = null;
async function checkAvailability() {
  try {
    webLLM = await import('@mlc-ai/web-llm');
    return true;
  } catch {
    return false;
  }
}

// 2. Progress reporting through telemetry
const span = tracer.startSpan('webllm.model.download');
span.setAttribute('model.id', modelId);
span.setAttribute('model.size_mb', sizeM);

engine.reload(modelId, {
  initProgressCallback: (report) => {
    span.addEvent('progress', {
      'progress.percent': report.progress,
      'progress.text': report.text,
    });
  }
});
```

### 6. React Hooks (useChat, useCompletion)

**Extensions for web-llm:**
```typescript
// 1. Loading state management (similar pattern)
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<Error | null>(null);

// 2. Progress state
const [downloadProgress, setDownloadProgress] = useState(0);
const [loadingPhase, setLoadingPhase] = useState<string>('');

// 3. Storage management
const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);

// 4. Abort handling
const abortControllerRef = useRef<AbortController | null>(null);
useEffect(() => {
  return () => {
    abortControllerRef.current?.abort();
  };
}, []);
```

---

## Implementation Phases

### Phase 1: Core Backend Adapter (2 weeks)

**Goal:** Basic chat completions working

**Tasks:**
1. Create `src/adapters/backend/web-llm.ts`
2. Implement `WebLLMBackendAdapter` class
3. Runtime availability checks (WebGPU)
4. Basic chat completions (non-streaming)
5. Streaming support
6. Error handling
7. Unit tests with mock web-llm

**Deliverables:**
- ✅ `WebLLMBackendAdapter` class
- ✅ Tests (95%+ coverage)
- ✅ Example usage script

**Success Criteria:**
- Chat completions work in browser
- Streaming works correctly
- Error handling matches other adapters
- No memory leaks

### Phase 2: Model Management (1.5 weeks)

**Goal:** Download, load, and manage models

**Tasks:**
1. Model listing from web-llm prebuilt configs
2. Download progress tracking
3. Model caching (IndexedDB) abstraction
4. Load/unload/delete operations
5. Storage quota management
6. Model metadata (size, requirements, etc.)

**Deliverables:**
- ✅ `listModels()` implementation
- ✅ `downloadModel()` with progress
- ✅ `getStorageInfo()` implementation
- ✅ Storage management utilities

**Success Criteria:**
- Can list available models
- Download with progress tracking
- Models persist across sessions
- Storage quota respected

### Phase 3: React Hooks (1 week)

**Goal:** UI-friendly model management

**Tasks:**
1. Create `useWebLLM` hook
2. Create `useModelManager` hook
3. Progress UI components
4. Storage quota visualization
5. Example implementations

**Deliverables:**
- ✅ `src/react/use-web-llm.ts`
- ✅ `src/react/use-model-manager.ts`
- ✅ Example React app in `examples/react/web-llm-chat.tsx`
- ✅ Documentation

**Success Criteria:**
- Hooks work in React apps
- Progress updates smoothly
- Storage management intuitive
- Examples work out-of-box

### Phase 4: Router Integration (1 week)

**Goal:** Smart routing between cloud and browser

**Tasks:**
1. Create web-llm routing strategy
2. Implement fallback logic
3. Offline detection and handling
4. Cost-based routing
5. Latency-based routing

**Deliverables:**
- ✅ `WebLLMRoutingStrategy` class
- ✅ Router integration tests
- ✅ Example demonstrating fallback

**Success Criteria:**
- Seamless fallback to cloud
- Offline mode works
- Cost optimization measurable
- No user-visible errors

### Phase 5: Advanced Features (0.5 weeks)

**Goal:** Polish and optimization

**Tasks:**
1. Tool calling support (web-llm has this!)
2. Structured output with `generateObject()`
3. Multi-model support (switch between models)
4. Memory optimization
5. Telemetry integration

**Deliverables:**
- ✅ Tool calling examples
- ✅ Structured output working
- ✅ Memory profiling tools
- ✅ OpenTelemetry spans

**Success Criteria:**
- Tool calling works same as OpenAI
- `generateObject()` works with web-llm backend
- Memory usage reasonable
- Telemetry tracks all operations

---

## Technical Design

### File Structure

```
src/
├── adapters/
│   └── backend/
│       ├── web-llm.ts          # NEW: Main adapter
│       └── web-llm-models.ts   # NEW: Model configurations
├── react/
│   ├── use-web-llm.ts          # NEW: Main hook
│   ├── use-model-manager.ts    # NEW: Model management
│   └── types.ts                # Updated with web-llm types
├── utils/
│   ├── webgpu.ts               # NEW: WebGPU detection
│   └── browser-storage.ts      # NEW: Storage management
└── types/
    └── web-llm.ts              # NEW: Type definitions

tests/
├── adapters/
│   └── backend/
│       └── web-llm.test.ts     # NEW: Adapter tests
└── react/
    ├── use-web-llm.test.ts     # NEW: Hook tests
    └── use-model-manager.test.ts # NEW: Manager tests

examples/
└── react/
    ├── web-llm-chat.tsx        # NEW: Full chat example
    ├── model-manager.tsx       # NEW: Model management UI
    └── hybrid-routing.tsx      # NEW: Cloud + browser routing

docs/
├── web-llm.md                  # NEW: User documentation
└── WEB_LLM_INTEGRATION_PLAN.md # This file
```

### Class Hierarchy

```typescript
// Main adapter class
export class WebLLMBackendAdapter implements BackendAdapter {
  private engine: MLCEngine | null = null;
  private currentModel: string | null = null;

  // Core methods
  async execute(request: IRChatRequest): Promise<IRChatResponse>
  async *executeStream(request: IRChatRequest): AsyncGenerator<IRStreamChunk>

  // Model management
  async listModels(): Promise<AIModel[]>
  async downloadModel(modelId: string, onProgress?: ProgressCallback): Promise<void>
  async loadModel(modelId: string): Promise<void>
  async unloadModel(): Promise<void>

  // Lifecycle
  async healthCheck(): Promise<boolean>
  async getCapabilities(): Promise<RuntimeCapabilities>
}

// Model configuration
export class WebLLMModelRegistry {
  static getDefaultModels(): WebLLMModelInfo[]
  static getModelInfo(modelId: string): WebLLMModelInfo | null
  static filterByRequirements(caps: RuntimeCapabilities): WebLLMModelInfo[]
}

// Storage management
export class WebLLMStorage {
  static async getInfo(): Promise<StorageInfo>
  static async clearCache(): Promise<void>
  static async evictLRU(targetSize: number): Promise<void>
}
```

---

## API Specifications

### WebLLMBackendAdapter

```typescript
import type { BackendAdapter } from '../../types/adapters.js';
import { MLCEngine, CreateMLCEngine } from '@mlc-ai/web-llm';

export interface WebLLMConfig extends BackendAdapterConfig {
  // Model to load on initialization
  defaultModel?: string;

  // Storage configuration
  cacheLocation?: 'indexeddb' | 'cache-api';
  maxCacheSizeMB?: number;

  // Performance tuning
  maxConcurrentLoads?: number;
  preferredDevice?: 'gpu' | 'cpu';

  // Progress callbacks
  onDownloadProgress?: ProgressCallback;
  onLoadProgress?: ProgressCallback;
}

export class WebLLMBackendAdapter implements BackendAdapter {
  readonly metadata: AdapterMetadata;
  private readonly config: WebLLMConfig;
  private engine: MLCEngine | null = null;
  private currentModel: string | null = null;
  private loadPromise: Promise<void> | null = null;

  constructor(config?: Partial<WebLLMConfig>) {
    this.config = {
      maxCacheSizeMB: 10000, // 10GB default
      cacheLocation: 'indexeddb',
      maxConcurrentLoads: 1,
      ...config,
    } as WebLLMConfig;

    this.metadata = {
      name: 'web-llm-backend',
      version: '1.0.0',
      provider: 'MLC WebLLM',
      capabilities: {
        streaming: true,
        multiModal: false,
        tools: true,  // web-llm supports function calling!
        json: true,
        maxContextTokens: 8192, // Model-dependent
        systemMessageStrategy: 'in-messages',
        supportsMultipleSystemMessages: true,
        supportsTemperature: true,
        supportsTopP: true,
        supportsTopK: false,
        supportsSeed: true,
        supportsFrequencyPenalty: false,
        supportsPresencePenalty: false,
        maxStopSequences: 4,
      },
      config: {},
    };
  }

  /**
   * Check if WebGPU and web-llm are available.
   */
  static async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (!navigator.gpu) return false;

    try {
      // Check if we can import web-llm
      await import('@mlc-ai/web-llm');

      // Check if GPU adapter available
      const adapter = await navigator.gpu.requestAdapter();
      return adapter !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get device capabilities (memory, supported models, etc.)
   */
  static async getCapabilities(): Promise<RuntimeCapabilities> {
    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter) {
      return {
        webGPUAvailable: false,
        browserCompatible: false,
        maxMemoryMB: 0,
        supportedModels: [],
      };
    }

    const limits = adapter.limits;
    return {
      webGPUAvailable: true,
      browserCompatible: true,
      maxMemoryMB: Math.floor(limits.maxBufferSize / 1024 / 1024),
      supportedModels: await this.getSupportedModels(),
    };
  }

  /**
   * List available models from web-llm registry.
   */
  async listModels(): Promise<AIModel[]> {
    // Import model list from web-llm
    const { prebuiltAppConfig } = await import('@mlc-ai/web-llm');

    return prebuiltAppConfig.model_list.map((model: any) => ({
      id: model.model_id,
      name: model.model_id,
      provider: 'web-llm',
      contextWindow: model.context_window || 8192,
      maxOutput: model.max_output || 2048,
      capabilities: {
        chat: true,
        completion: true,
        streaming: true,
        tools: true,
        json: true,
      },
      pricing: {
        input: 0,  // Free! Browser-local
        output: 0,
      },
      metadata: {
        vramRequiredMB: model.vram_required_MB,
        sizeMB: model.size_MB,
        lowResource: model.low_resource_required,
      },
    }));
  }

  /**
   * Download a model with progress tracking.
   */
  async downloadModel(
    modelId: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    const callback = onProgress || this.config.onDownloadProgress;

    // web-llm downloads automatically during engine creation
    // We track progress through the callback
    await CreateMLCEngine(modelId, {
      initProgressCallback: (report) => {
        callback?.({
          phase: 'downloading',
          progress: report.progress * 100,
          text: report.text,
          timeElapsed: Date.now() - startTime,
        });
      },
    });
  }

  /**
   * Load a model into memory.
   */
  async loadModel(modelId: string): Promise<void> {
    // Prevent concurrent loads
    if (this.loadPromise) {
      await this.loadPromise;
    }

    this.loadPromise = this._loadModelInternal(modelId);
    await this.loadPromise;
    this.loadPromise = null;
  }

  private async _loadModelInternal(modelId: string): Promise<void> {
    const callback = this.config.onLoadProgress;

    if (this.engine && this.currentModel === modelId) {
      // Already loaded
      return;
    }

    // Unload current model if different
    if (this.engine && this.currentModel !== modelId) {
      await this.unloadModel();
    }

    // Create new engine
    const startTime = Date.now();
    this.engine = await CreateMLCEngine(modelId, {
      initProgressCallback: (report) => {
        callback?.({
          phase: report.progress < 1 ? 'loading' : 'ready',
          progress: report.progress * 100,
          text: report.text,
          timeElapsed: Date.now() - startTime,
        });
      },
    });

    this.currentModel = modelId;
  }

  /**
   * Unload current model from memory.
   */
  async unloadModel(): Promise<void> {
    if (this.engine) {
      // web-llm doesn't have explicit unload,
      // but we can nullify and let GC handle it
      this.engine = null;
      this.currentModel = null;
    }
  }

  /**
   * Execute non-streaming chat completion.
   */
  async execute(
    request: IRChatRequest,
    signal?: AbortSignal
  ): Promise<IRChatResponse> {
    if (!this.engine) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    const startTime = Date.now();

    // Convert IR to web-llm format (OpenAI-compatible)
    const messages = request.messages.map((msg) => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    }));

    // Call web-llm
    const response = await this.engine.chat.completions.create({
      messages,
      temperature: request.parameters?.temperature,
      top_p: request.parameters?.topP,
      max_tokens: request.parameters?.maxTokens,
      seed: request.parameters?.seed,
      stream: false,
    });

    // Convert to IR
    return {
      message: {
        role: 'assistant',
        content: response.choices[0].message.content || '',
      },
      finishReason: this.mapFinishReason(response.choices[0].finish_reason),
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
      metadata: {
        ...request.metadata,
        providerResponseId: response.id,
        provenance: {
          ...request.metadata.provenance,
          backend: this.metadata.name,
        },
        custom: {
          ...request.metadata.custom,
          latencyMs: Date.now() - startTime,
          model: this.currentModel,
        },
      },
    };
  }

  /**
   * Execute streaming chat completion.
   */
  async *executeStream(
    request: IRChatRequest,
    signal?: AbortSignal
  ): AsyncGenerator<IRStreamChunk> {
    if (!this.engine) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    const messages = request.messages.map((msg) => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    }));

    const stream = await this.engine.chat.completions.create({
      messages,
      temperature: request.parameters?.temperature,
      top_p: request.parameters?.topP,
      max_tokens: request.parameters?.maxTokens,
      seed: request.parameters?.seed,
      stream: true,
    });

    let sequence = 0;
    let accumulatedContent = '';

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';

      if (delta) {
        accumulatedContent += delta;

        yield {
          type: 'content',
          sequence: sequence++,
          delta,
          accumulated: accumulatedContent,
        };
      }

      if (chunk.choices[0]?.finish_reason) {
        yield {
          type: 'done',
          sequence: sequence++,
          finishReason: this.mapFinishReason(chunk.choices[0].finish_reason),
          message: {
            role: 'assistant',
            content: accumulatedContent,
          },
          usage: chunk.usage ? {
            promptTokens: chunk.usage.prompt_tokens || 0,
            completionTokens: chunk.usage.completion_tokens || 0,
            totalTokens: chunk.usage.total_tokens || 0,
          } : undefined,
        };
      }
    }
  }

  private mapFinishReason(reason: string): FinishReason {
    switch (reason) {
      case 'stop': return 'stop';
      case 'length': return 'length';
      case 'tool_calls': return 'tool_calls';
      default: return 'stop';
    }
  }

  async healthCheck(): Promise<boolean> {
    return this.engine !== null;
  }

  fromIR(request: IRChatRequest): any {
    // web-llm uses OpenAI format, minimal conversion
    return request;
  }

  toIR(response: any, request: IRChatRequest, latencyMs: number): IRChatResponse {
    // web-llm returns OpenAI format, minimal conversion
    return response;
  }
}
```

### React Hooks API

```typescript
// useWebLLM hook
export function useWebLLM(options: UseWebLLMOptions): UseWebLLMReturn {
  const {
    modelId,
    autoLoad = false,
    onProgress,
    backend = new WebLLMBackendAdapter(),
  } = options;

  // Model state
  const [isAvailable, setIsAvailable] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  // Storage state
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);

  // Check availability on mount
  useEffect(() => {
    WebLLMBackendAdapter.isAvailable().then(setIsAvailable);
  }, []);

  // Auto-load if requested
  useEffect(() => {
    if (autoLoad && isAvailable && !isLoaded) {
      load();
    }
  }, [autoLoad, isAvailable, isLoaded]);

  const download = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await backend.downloadModel(modelId, (update) => {
        setProgress(update.progress);
        onProgress?.(update);
      });
      setIsDownloaded(true);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [modelId, backend, onProgress]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await backend.loadModel(modelId);
      setIsLoaded(true);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [modelId, backend]);

  const unload = useCallback(async () => {
    await backend.unloadModel();
    setIsLoaded(false);
  }, [backend]);

  const remove = useCallback(async () => {
    // Delete from cache
    await WebLLMStorage.deleteModel(modelId);
    setIsDownloaded(false);
  }, [modelId]);

  // Inherit chat functionality from useChat
  const chat = useChat({
    backend,
    messages: options.initialMessages,
  });

  return {
    // Model state
    isAvailable,
    isDownloaded,
    isLoading,
    isLoaded,
    progress,
    error,

    // Actions
    download,
    load,
    unload,
    remove,

    // Storage
    storageInfo,
    clearCache: WebLLMStorage.clearCache,

    // Chat (from useChat)
    ...chat,
  };
}
```

---

## Challenges & Solutions

### Challenge 1: Large Model Sizes (1-8GB)

**Problem:**
- Models are very large (1-8GB compressed)
- Download can take 10-60 minutes on slow connections
- Users might abandon during download

**Solutions:**
1. **Progressive Loading UI**
   - Show estimated time remaining
   - Allow backgrounding (Service Worker)
   - Resume interrupted downloads

2. **Smart Model Selection**
   - Recommend smaller models for slower connections
   - Detect connection speed and suggest appropriate model
   - Offer "lite" versions first

3. **Preloading Strategy**
   - Download during user onboarding
   - Background download during idle time
   - Progressive Web App with Service Worker

### Challenge 2: Browser Storage Limits

**Problem:**
- IndexedDB quota varies by browser (typically 2GB-10GB)
- Users might have multiple models
- Can exceed quota

**Solutions:**
1. **LRU Cache Eviction**
   - Track last-used timestamp
   - Auto-evict least recently used models
   - Warn before eviction

2. **Storage Quota Management**
   - Request persistent storage
   - Show quota usage in UI
   - Allow manual model deletion

3. **Compression**
   - Models are already quantized (q4, q8)
   - Additional compression at rest
   - Decompress on load

### Challenge 3: WebGPU Browser Support

**Problem:**
- WebGPU not available in all browsers
- Safari support limited
- Mobile browsers vary

**Solutions:**
1. **Feature Detection**
   - Check WebGPU availability upfront
   - Fallback to cloud providers
   - Clear error messages

2. **Progressive Enhancement**
   ```typescript
   if (await WebLLMBackendAdapter.isAvailable()) {
     // Use browser model
   } else {
     // Fallback to cloud (OpenAI, etc.)
   }
   ```

3. **Browser Recommendations**
   - Suggest Chrome/Edge if WebGPU missing
   - Show compatibility matrix

### Challenge 4: Memory Constraints

**Problem:**
- Large models require significant VRAM
- Browser tab memory limits
- Can cause browser crashes

**Solutions:**
1. **Memory Estimation**
   ```typescript
   const caps = await WebLLMBackendAdapter.getCapabilities();
   if (caps.maxMemoryMB < model.vramRequiredMB) {
     // Warn user, suggest smaller model
   }
   ```

2. **Streaming Inference**
   - web-llm already uses streaming
   - Reduces memory spikes

3. **Single Model Limit**
   - Unload previous model before loading new
   - No concurrent model execution

### Challenge 5: Initial Load Time

**Problem:**
- Even after download, loading model into memory takes 30-60s
- Users see blank screen

**Solutions:**
1. **Loading UI**
   - Progress bar with phases
   - Estimated time
   - "First time setup" messaging

2. **Lazy Loading**
   - Don't load until first message
   - Preload during conversation

3. **Persistent Sessions**
   - Keep model loaded across page navigations
   - Use SharedWorker for cross-tab sharing

---

## Testing Strategy

### Unit Tests

```typescript
// tests/adapters/backend/web-llm.test.ts
describe('WebLLMBackendAdapter', () => {
  describe('availability check', () => {
    it('should return false in Node.js environment', async () => {
      expect(await WebLLMBackendAdapter.isAvailable()).toBe(false);
    });

    it('should detect WebGPU availability in browser', async () => {
      // Mock navigator.gpu
      global.navigator.gpu = mockGPU;
      expect(await WebLLMBackendAdapter.isAvailable()).toBe(true);
    });
  });

  describe('model management', () => {
    it('should list available models', async () => {
      const adapter = new WebLLMBackendAdapter();
      const models = await adapter.listModels();
      expect(models.length).toBeGreaterThan(0);
      expect(models[0]).toHaveProperty('id');
    });

    it('should track download progress', async () => {
      const progressUpdates: number[] = [];
      await adapter.downloadModel('test-model', (update) => {
        progressUpdates.push(update.progress);
      });
      expect(progressUpdates).toContain(100);
    });
  });

  describe('chat completions', () => {
    it('should execute non-streaming request', async () => {
      await adapter.loadModel('test-model');
      const response = await adapter.execute({
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect(response.message.content).toBeDefined();
    });

    it('should stream responses', async () => {
      const chunks: string[] = [];
      for await (const chunk of adapter.executeStream(request)) {
        if (chunk.type === 'content') {
          chunks.push(chunk.delta);
        }
      }
      expect(chunks.join('')).not.toBe('');
    });
  });
});
```

### Integration Tests

```typescript
// tests/integration/web-llm.test.ts
describe('WebLLM Integration', () => {
  it('should work with Bridge', async () => {
    const backend = new WebLLMBackendAdapter();
    const bridge = new Bridge(backend);

    const response = await bridge.chat({
      messages: [{ role: 'user', content: 'Test' }],
    });
    expect(response.message).toBeDefined();
  });

  it('should work with Router fallback', async () => {
    const router = new Router({
      backends: [
        { adapter: new WebLLMBackendAdapter(), priority: 1 },
        { adapter: new OpenAIBackendAdapter(), priority: 2 },
      ],
      strategy: 'fallback',
    });

    // Should try web-llm first, fallback to OpenAI
    const response = await router.route(request);
    expect(response).toBeDefined();
  });

  it('should work with structured output', async () => {
    const backend = new WebLLMBackendAdapter();
    await backend.loadModel('test-model');

    const result = await generateObject({
      backend,
      schema: UserSchema,
      messages: [{ role: 'user', content: 'John, 30' }],
    });

    expect(result.data.name).toBe('John');
  });
});
```

### Browser Tests (Playwright)

```typescript
// tests/browser/web-llm.spec.ts
test('should load model in browser', async ({ page }) => {
  await page.goto('http://localhost:3000/web-llm-demo');

  // Wait for model load
  await page.click('button:has-text("Load Model")');
  await expect(page.locator('.progress')).toBeVisible();
  await expect(page.locator('.loaded')).toBeVisible({ timeout: 120000 });

  // Send message
  await page.fill('input[name="message"]', 'Hello!');
  await page.click('button[type="submit"]');

  // Wait for response
  await expect(page.locator('.message.assistant')).toBeVisible();
});
```

---

## Success Metrics

### Technical Metrics

1. **Adapter Performance**
   - Model load time < 60s (after download)
   - Streaming latency < 100ms per token
   - Memory usage < model's vram_required_MB + 500MB
   - No memory leaks over 100 messages

2. **Download Performance**
   - Resume works after interruption
   - Progress tracking accurate (±5%)
   - Parallel downloads don't corrupt cache

3. **Reliability**
   - 99%+ success rate for chat completions
   - Proper error handling for OOM
   - Graceful fallback when WebGPU unavailable

### User Experience Metrics

1. **First Message Latency**
   - Model already loaded: < 1s
   - Model needs loading: < 60s with progress
   - Model needs download: Show ETA, allow background

2. **Chat Performance**
   - Time to first token: < 500ms
   - Tokens per second: > 10 tps (model-dependent)
   - UI responsiveness: No jank during inference

3. **Developer Experience**
   - Setup complexity: Same as other adapters
   - API compatibility: 100% with existing hooks
   - Documentation: Complete examples for common cases

---

## Next Steps

1. **Create GitHub Issue** - Propose integration, gather feedback
2. **Prototype** - Build basic adapter in branch
3. **Test with Real Models** - Validate performance assumptions
4. **Community Review** - Share with ai.matey users
5. **Iterate** - Refine based on feedback
6. **Documentation** - Write comprehensive user guide
7. **Release** - Ship as v0.2.0 feature

---

## Appendix

### A. Supported Models (web-llm)

| Model | Size | VRAM | Context | Notes |
|-------|------|------|---------|-------|
| Llama-3.1-8B (q4f32_1) | 4.3GB | 5.5GB | 8K | Best balance |
| Phi-3-mini (q4f16_1) | 2.2GB | 3.0GB | 4K | Fastest |
| Gemma-2B (q4f16_1) | 1.5GB | 2.5GB | 2K | Smallest |
| Mistral-7B (q4f16_1) | 4.0GB | 5.0GB | 8K | Good quality |
| Qwen2-7B (q4f16_1) | 4.2GB | 5.2GB | 32K | Long context |

### B. Browser Compatibility

| Browser | WebGPU | web-llm | Notes |
|---------|--------|---------|-------|
| Chrome 113+ | ✅ | ✅ | Full support |
| Edge 113+ | ✅ | ✅ | Full support |
| Firefox 121+ | 🚧 | 🚧 | Experimental flag |
| Safari 18+ | ⚠️ | ⚠️ | Limited |
| Mobile Chrome | ⚠️ | ⚠️ | High-end devices only |

### C. References

- [web-llm GitHub](https://github.com/mlc-ai/web-llm)
- [mlc-llm GitHub](https://github.com/mlc-ai/mlc-llm)
- [WebLLM Documentation](https://webllm.mlc.ai/)
- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
- [ai.matey Roadmap](./ROADMAP.md)

---

**Document Version:** 1.0
**Last Updated:** 2025-10-28
**Authors:** Claude Code Integration Team
**Status:** ✅ Ready for Review
