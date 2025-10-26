/**
 * OpenAI SDK Wrapper
 *
 * Mimics the OpenAI SDK interface using any backend adapter.
 * Allows you to use OpenAI SDK-style code with any provider.
 *
 * @module
 */

import type { BackendAdapter } from '../types/adapters.js';
import type { IRChatRequest, IRMessage } from '../types/ir.js';
import type { StreamMode } from '../types/streaming.js';
import type { AIModel, ListModelsOptions, ListModelsResult } from '../types/models.js';

// ============================================================================
// OpenAI SDK Compatible Types
// ============================================================================

/**
 * OpenAI message format.
 */
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * OpenAI chat completion request parameters.
 */
export interface OpenAIChatCompletionParams {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  stream?: boolean;
  user?: string;
}

/**
 * OpenAI chat completion choice.
 */
export interface OpenAIChatCompletionChoice {
  index: number;
  message: OpenAIMessage;
  finish_reason: 'stop' | 'length' | 'content_filter' | null;
}

/**
 * OpenAI usage information.
 */
export interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * OpenAI chat completion response.
 */
export interface OpenAIChatCompletion {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: OpenAIChatCompletionChoice[];
  usage: OpenAIUsage;
}

/**
 * OpenAI streaming chunk delta.
 */
export interface OpenAIStreamDelta {
  role?: 'assistant';
  content?: string;
}

/**
 * OpenAI streaming chunk choice.
 */
export interface OpenAIStreamChoice {
  index: number;
  delta: OpenAIStreamDelta;
  finish_reason: 'stop' | 'length' | 'content_filter' | null;
}

/**
 * OpenAI chat completion chunk (streaming).
 */
export interface OpenAIChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: OpenAIStreamChoice[];
}

/**
 * OpenAI Model object.
 */
export interface OpenAIModel {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}

/**
 * OpenAI Models list page.
 */
export interface OpenAIModelsPage {
  object: 'list';
  data: OpenAIModel[];
}

/**
 * OpenAI SDK wrapper configuration.
 */
export interface OpenAISDKConfig {
  /**
   * Streaming mode for stream responses.
   * @default 'delta'
   */
  streamMode?: StreamMode;
}

// ============================================================================
// OpenAI SDK Wrapper Implementation
// ============================================================================

/**
 * Chat completions interface (mimics OpenAI SDK).
 */
export class ChatCompletions {
  private backend: BackendAdapter;
  private config: OpenAISDKConfig;

  constructor(backend: BackendAdapter, config: OpenAISDKConfig = {}) {
    this.backend = backend;
    this.config = config;
  }

  /**
   * Create a chat completion (non-streaming).
   */
  async create(params: OpenAIChatCompletionParams & { stream?: false | undefined }): Promise<OpenAIChatCompletion>;

  /**
   * Create a chat completion (streaming).
   */
  create(params: OpenAIChatCompletionParams & { stream: true }): AsyncIterable<OpenAIChatCompletionChunk>;

  /**
   * Create a chat completion.
   */
  create(params: OpenAIChatCompletionParams): Promise<OpenAIChatCompletion> | AsyncIterable<OpenAIChatCompletionChunk> {
    if (params.stream) {
      return this.createStream(params);
    }
    return this.createNonStream(params);
  }

  private async createNonStream(params: OpenAIChatCompletionParams): Promise<OpenAIChatCompletion> {
    // Convert to IR request
    const messages: IRMessage[] = params.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const request: IRChatRequest = {
      messages,
      parameters: {
        model: params.model,
        temperature: params.temperature,
        maxTokens: params.max_tokens,
        topP: params.top_p,
        frequencyPenalty: params.frequency_penalty,
        presencePenalty: params.presence_penalty,
        stopSequences: params.stop,
        user: params.user,
      },
      stream: false,
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
        provenance: {
          frontend: 'openai-sdk-wrapper',
        },
      },
    };

    // Execute via backend
    const response = await this.backend.execute(request);

    // Convert to OpenAI format
    const content = typeof response.message.content === 'string'
      ? response.message.content
      : response.message.content.map((c) => (c.type === 'text' ? c.text : '')).join('');

    return {
      id: response.metadata.providerResponseId || response.metadata.requestId,
      object: 'chat.completion',
      created: Math.floor(response.metadata.timestamp / 1000),
      model: params.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content,
          },
          finish_reason: this.mapFinishReason(response.finishReason),
        },
      ],
      usage: {
        prompt_tokens: response.usage?.promptTokens || 0,
        completion_tokens: response.usage?.completionTokens || 0,
        total_tokens: response.usage?.totalTokens || 0,
      },
    };
  }

  private async *createStream(params: OpenAIChatCompletionParams): AsyncIterable<OpenAIChatCompletionChunk> {
    // Convert to IR request
    const messages: IRMessage[] = params.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const requestId = crypto.randomUUID();
    const created = Math.floor(Date.now() / 1000);

    const request: IRChatRequest = {
      messages,
      parameters: {
        model: params.model,
        temperature: params.temperature,
        maxTokens: params.max_tokens,
        topP: params.top_p,
        frequencyPenalty: params.frequency_penalty,
        presencePenalty: params.presence_penalty,
        stopSequences: params.stop,
        user: params.user,
      },
      stream: true,
      streamMode: this.config.streamMode,
      metadata: {
        requestId,
        timestamp: Date.now(),
        provenance: {
          frontend: 'openai-sdk-wrapper',
        },
      },
    };

    // Execute via backend
    const stream = this.backend.executeStream(request);

    for await (const chunk of stream) {
      if (chunk.type === 'content') {
        yield {
          id: requestId,
          object: 'chat.completion.chunk',
          created,
          model: params.model,
          choices: [
            {
              index: 0,
              delta: {
                role: 'assistant',
                content: chunk.delta,
              },
              finish_reason: null,
            },
          ],
        };
      } else if (chunk.type === 'done') {
        yield {
          id: requestId,
          object: 'chat.completion.chunk',
          created,
          model: params.model,
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: this.mapFinishReason(chunk.finishReason),
            },
          ],
        };
      }
    }
  }

  private mapFinishReason(reason: string): 'stop' | 'length' | 'content_filter' | null {
    switch (reason) {
      case 'stop': return 'stop';
      case 'length': return 'length';
      case 'content_filter': return 'content_filter';
      default: return null;
    }
  }
}

/**
 * Models interface (mimics OpenAI SDK).
 */
export class Models {
  private backend: BackendAdapter;

  constructor(backend: BackendAdapter) {
    this.backend = backend;
  }

  /**
   * List available models.
   *
   * @param options - List options (forceRefresh, filter)
   * @returns List of models in OpenAI format
   */
  async list(options?: ListModelsOptions): Promise<OpenAIModelsPage> {
    // Check if backend supports model listing
    if (!this.backend.listModels) {
      // Return empty list if backend doesn't support it
      return {
        object: 'list',
        data: [],
      };
    }

    // Get models from backend
    const result: ListModelsResult = await this.backend.listModels(options);

    // Convert to OpenAI format
    const data: OpenAIModel[] = result.models.map((model: AIModel) => ({
      id: model.id,
      object: 'model' as const,
      created: model.created ? new Date(model.created).getTime() / 1000 : Math.floor(result.fetchedAt / 1000),
      owned_by: model.ownedBy || 'unknown',
    }));

    return {
      object: 'list',
      data,
    };
  }

  /**
   * Retrieve information about a specific model.
   *
   * @param modelId - Model identifier
   * @returns Model information in OpenAI format
   */
  async retrieve(modelId: string): Promise<OpenAIModel | null> {
    // Check if backend supports model listing
    if (!this.backend.listModels) {
      return null;
    }

    // Get all models
    const result: ListModelsResult = await this.backend.listModels();

    // Find the specific model
    const model = result.models.find((m: AIModel) => m.id === modelId);
    if (!model) {
      return null;
    }

    // Convert to OpenAI format
    return {
      id: model.id,
      object: 'model',
      created: model.created ? new Date(model.created).getTime() / 1000 : Math.floor(result.fetchedAt / 1000),
      owned_by: model.ownedBy || 'unknown',
    };
  }
}

/**
 * Chat interface (mimics OpenAI SDK).
 */
export class Chat {
  readonly completions: ChatCompletions;

  constructor(backend: BackendAdapter, config: OpenAISDKConfig = {}) {
    this.completions = new ChatCompletions(backend, config);
  }
}

/**
 * OpenAI SDK-compatible client.
 */
export class OpenAIClient {
  readonly chat: Chat;
  readonly models: Models;

  constructor(backend: BackendAdapter, config: OpenAISDKConfig = {}) {
    this.chat = new Chat(backend, config);
    this.models = new Models(backend);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an OpenAI SDK-compatible client using any backend adapter.
 *
 * @example
 * ```typescript
 * import { OpenAI } from 'ai.matey/wrappers/openai-sdk';
 * import { AnthropicBackendAdapter } from 'ai.matey';
 *
 * const backend = new AnthropicBackendAdapter({ apiKey: 'sk-ant-...' });
 * const client = OpenAI(backend);
 *
 * const completion = await client.chat.completions.create({
 *   model: 'claude-3-5-sonnet',
 *   messages: [
 *     { role: 'user', content: 'Hello!' }
 *   ],
 * });
 *
 * console.log(completion.choices[0].message.content);
 * ```
 */
export function OpenAI(backend: BackendAdapter, config?: OpenAISDKConfig): OpenAIClient {
  return new OpenAIClient(backend, config);
}
