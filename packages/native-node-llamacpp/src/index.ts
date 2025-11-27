/**
 * Node-LlamaCpp Backend Adapter
 *
 * Backend adapter using node-llama-cpp native bindings.
 * This provides direct access to llama.cpp without spawning external processes.
 *
 * @example Basic Usage
 * ```typescript
 * import { NodeLlamaCppBackend } from 'ai.matey/adapters/backend-native';
 *
 * const backend = new NodeLlamaCppBackend({
 *   modelPath: './models/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
 *   contextSize: 2048,
 *   gpuLayers: 0, // Set to > 0 for GPU acceleration
 * });
 *
 * await backend.initialize();
 * const response = await backend.execute(request);
 * ```
 *
 * @module
 */

import type { BackendAdapter, BackendAdapterConfig, AdapterMetadata } from 'ai.matey.types';
import type {
  IRChatRequest,
  IRChatResponse,
  IRChatStream,
  IRStreamChunk,
  MessageContent,
} from 'ai.matey.types';
import { AdapterError, ErrorCode, ProviderError } from 'ai.matey.errors';

// Dynamic import to handle node-llama-cpp
let getLlama: any;
let LlamaChatSession: any;

async function loadLlamaCpp() {
  if (!getLlama) {
    try {
      // @ts-expect-error - Optional peer dependency, may not be installed
      const llamaCpp = await import('node-llama-cpp');
      getLlama = llamaCpp.getLlama;
      LlamaChatSession = llamaCpp.LlamaChatSession;
    } catch {
      throw new AdapterError({
        code: ErrorCode.PROVIDER_ERROR,
        message:
          'Failed to load node-llama-cpp. Make sure it is installed: npm install node-llama-cpp',
      });
    }
  }
}

export interface NodeLlamaCppConfig extends Partial<BackendAdapterConfig> {
  /** Path to the GGUF model file. Can be relative (resolved from cwd) or absolute. */
  modelPath: string;
  /** Context window size. Default: 2048 */
  contextSize?: number;
  /** Number of layers to offload to GPU. 0 = CPU only. Default: 0 */
  gpuLayers?: number;
  /** Sampling temperature. Default: 0.7 */
  temperature?: number;
  /** Top-p sampling. Default: 0.9 */
  topP?: number;
  /** Top-k sampling. Default: 40 */
  topK?: number;
  /** Batch size for prompt processing. Default: 512 */
  batchSize?: number;
  /** Number of CPU threads to use. Defaults to optimal value. */
  threads?: number;
}

/**
 * Backend adapter for node-llama-cpp.
 *
 * Uses native bindings to llama.cpp for efficient local inference.
 */
export class NodeLlamaCppBackend implements BackendAdapter {
  readonly metadata: AdapterMetadata = {
    name: 'node-llamacpp-backend',
    version: '1.0.0',
    provider: 'llama.cpp (node bindings)',
    capabilities: {
      streaming: true,
      multiModal: false,
      systemMessageStrategy: 'in-messages',
      supportsMultipleSystemMessages: false,
    },
  };

  private readonly config: NodeLlamaCppConfig;
  private llama: any;
  private model: any;
  private context: any;
  private session: any;
  private initialized: boolean = false;

  constructor(config: NodeLlamaCppConfig) {
    this.config = {
      contextSize: 2048,
      gpuLayers: 0,
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      batchSize: 512,
      ...config,
    };
  }

  /**
   * Initialize the model and context.
   * Must be called before using execute() or executeStream().
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await loadLlamaCpp();

      // Get llama instance
      this.llama = await getLlama();

      // Load the model
      this.model = await this.llama.loadModel({
        modelPath: this.config.modelPath,
        gpuLayers: this.config.gpuLayers,
      });

      // Create context
      this.context = await this.model.createContext({
        contextSize: this.config.contextSize,
        batchSize: this.config.batchSize,
        threads: this.config.threads,
      });

      // Create chat session
      this.session = new LlamaChatSession({
        contextSequence: this.context.getSequence(),
      });

      this.initialized = true;
    } catch (error) {
      throw new ProviderError({
        code: ErrorCode.PROVIDER_ERROR,
        message: `Failed to initialize node-llama-cpp: ${error instanceof Error ? error.message : String(error)}`,
        isRetryable: false,
        provenance: { backend: this.metadata.name },
      });
    }
  }

  /**
   * Convert IR request to provider format (passthrough - uses IR internally).
   */
  fromIR(request: IRChatRequest): IRChatRequest {
    return request;
  }

  /**
   * Convert provider response to IR format (passthrough - uses IR internally).
   */
  toIR(
    response: IRChatResponse,
    _originalRequest: IRChatRequest,
    _latencyMs: number
  ): IRChatResponse {
    return response;
  }

  /**
   * Execute a non-streaming chat request.
   */
  async execute(request: IRChatRequest): Promise<IRChatResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Extract the user's message (last message)
      const userMessage = request.messages[request.messages.length - 1];
      if (!userMessage) {
        throw new AdapterError({
          code: ErrorCode.INVALID_REQUEST,
          message: 'No messages in request',
        });
      }
      const userContent = this.extractTextContent(userMessage.content);

      // For now, we'll use a simple prompt (could be enhanced with chat templates)
      const systemMessages = request.messages.filter((m) => m.role === 'system');
      let prompt = '';

      if (systemMessages.length > 0) {
        const systemContent = systemMessages
          .map((m) => this.extractTextContent(m.content))
          .join('\n');
        prompt += `System: ${systemContent}\n\n`;
      }

      prompt += `User: ${userContent}\nAssistant:`;

      // Generate response
      const response = await this.session.prompt(prompt, {
        temperature: request.parameters?.temperature ?? this.config.temperature,
        topP: request.parameters?.topP ?? this.config.topP,
        topK: request.parameters?.topK ?? this.config.topK,
        maxTokens: request.parameters?.maxTokens ?? 512,
      });

      // Estimate token usage (rough approximation)
      const inputTokens = Math.ceil(prompt.length / 4);
      const outputTokens = Math.ceil(response.length / 4);

      return {
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: response }],
        },
        finishReason: 'stop',
        usage: {
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        metadata: {
          ...request.metadata,
          provenance: {
            backend: this.metadata.name,
          },
        },
      };
    } catch (error) {
      throw new ProviderError({
        code: ErrorCode.PROVIDER_ERROR,
        message: `llama.cpp inference failed: ${error instanceof Error ? error.message : String(error)}`,
        isRetryable: false,
        provenance: { backend: this.metadata.name },
      });
    }
  }

  /**
   * Execute a streaming chat request.
   */
  async *executeStream(request: IRChatRequest): IRChatStream {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Extract the user's message
      const userMessage = request.messages[request.messages.length - 1];
      if (!userMessage) {
        yield {
          type: 'error',
          sequence: 0,
          error: {
            code: ErrorCode.INVALID_REQUEST,
            message: 'No messages in request',
            details: {},
          },
        } as IRStreamChunk;
        return;
      }
      const userContent = this.extractTextContent(userMessage.content);

      // Build prompt
      const systemMessages = request.messages.filter((m) => m.role === 'system');
      let prompt = '';

      if (systemMessages.length > 0) {
        const systemContent = systemMessages
          .map((m) => this.extractTextContent(m.content))
          .join('\n');
        prompt += `System: ${systemContent}\n\n`;
      }

      prompt += `User: ${userContent}\nAssistant:`;

      let sequence = 0;

      // Yield start chunk
      yield {
        type: 'start',
        sequence: sequence++,
      } as IRStreamChunk;

      let fullText = '';
      const chunks: Array<{ delta: string; sequence: number }> = [];

      // Stream the response using callback (collect chunks for later yielding)
      await this.session.prompt(prompt, {
        temperature: request.parameters?.temperature ?? this.config.temperature,
        topP: request.parameters?.topP ?? this.config.topP,
        topK: request.parameters?.topK ?? this.config.topK,
        maxTokens: request.parameters?.maxTokens ?? 512,
        onTextChunk: (chunk: string) => {
          fullText += chunk;
          chunks.push({ delta: chunk, sequence: sequence++ });
        },
      });

      // Yield all collected chunks
      for (const chunk of chunks) {
        yield {
          type: 'content',
          sequence: chunk.sequence,
          delta: chunk.delta,
          role: 'assistant',
        } as IRStreamChunk;
      }

      // Yield done chunk
      const inputTokens = Math.ceil(prompt.length / 4);
      const outputTokens = Math.ceil(fullText.length / 4);

      yield {
        type: 'done',
        sequence: sequence++,
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: fullText }],
        },
        finishReason: 'stop',
        usage: {
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
      } as IRStreamChunk;
    } catch (error) {
      yield {
        type: 'error',
        sequence: 0,
        error: {
          code: ErrorCode.PROVIDER_ERROR,
          message: `llama.cpp streaming failed: ${error instanceof Error ? error.message : String(error)}`,
          details: {},
        },
      } as IRStreamChunk;
    }
  }

  /**
   * Clean up resources.
   */
  async dispose(): Promise<void> {
    if (this.session) {
      this.session = null;
    }
    if (this.context) {
      await this.context.dispose();
      this.context = null;
    }
    if (this.model) {
      await this.model.dispose();
      this.model = null;
    }
    if (this.llama) {
      await this.llama.dispose();
      this.llama = null;
    }
    this.initialized = false;
  }

  /**
   * Extract text content from message content.
   */
  private extractTextContent(content: string | readonly MessageContent[]): string {
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .filter((c) => typeof c !== 'string' && c.type === 'text')
        .map((c) => c.text)
        .join('\n');
    }
    return '';
  }
}
