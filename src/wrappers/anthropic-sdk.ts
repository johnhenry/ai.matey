/**
 * Anthropic SDK Wrapper
 *
 * Mimics the Anthropic SDK interface using any backend adapter.
 * Allows you to use Anthropic SDK-style code with any provider.
 *
 * @module
 */

import type { BackendAdapter } from '../types/adapters.js';
import type { IRChatRequest, IRMessage } from '../types/ir.js';
import type { StreamMode } from '../types/streaming.js';
import type { AIModel, ListModelsOptions, ListModelsResult } from '../types/models.js';

// ============================================================================
// Anthropic SDK Compatible Types
// ============================================================================

/**
 * Anthropic message format.
 */
export interface AnthropicSDKMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Anthropic message create parameters.
 */
export interface AnthropicMessageParams {
  model: string;
  messages: AnthropicSDKMessage[];
  max_tokens: number;
  system?: string;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  stream?: boolean;
}

/**
 * Anthropic content block.
 */
export interface AnthropicContentBlock {
  type: 'text';
  text: string;
}

/**
 * Anthropic usage information.
 */
export interface AnthropicSDKUsage {
  input_tokens: number;
  output_tokens: number;
}

/**
 * Anthropic message response.
 */
export interface AnthropicSDKMessageResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | null;
  stop_sequence: string | null;
  usage: AnthropicSDKUsage;
}

/**
 * Anthropic streaming message start event.
 */
export interface AnthropicMessageStart {
  type: 'message_start';
  message: Partial<AnthropicSDKMessageResponse>;
}

/**
 * Anthropic streaming content block start event.
 */
export interface AnthropicContentBlockStart {
  type: 'content_block_start';
  index: number;
  content_block: { type: 'text'; text: '' };
}

/**
 * Anthropic streaming content block delta event.
 */
export interface AnthropicContentBlockDelta {
  type: 'content_block_delta';
  index: number;
  delta: { type: 'text_delta'; text: string };
}

/**
 * Anthropic streaming content block stop event.
 */
export interface AnthropicContentBlockStop {
  type: 'content_block_stop';
  index: number;
}

/**
 * Anthropic streaming message delta event.
 */
export interface AnthropicMessageDelta {
  type: 'message_delta';
  delta: {
    stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | null;
    stop_sequence?: string | null;
  };
  usage: { output_tokens: number };
}

/**
 * Anthropic streaming message stop event.
 */
export interface AnthropicMessageStop {
  type: 'message_stop';
}

/**
 * Anthropic stream event.
 */
export type AnthropicStreamEvent =
  | AnthropicMessageStart
  | AnthropicContentBlockStart
  | AnthropicContentBlockDelta
  | AnthropicContentBlockStop
  | AnthropicMessageDelta
  | AnthropicMessageStop;

/**
 * Anthropic Model object.
 */
export interface AnthropicModel {
  id: string;
  display_name: string;
  created_at: string;
}

/**
 * Anthropic Models list response.
 */
export interface AnthropicModelsResponse {
  data: AnthropicModel[];
  has_more: boolean;
  first_id: string | null;
  last_id: string | null;
}

/**
 * Anthropic SDK wrapper configuration.
 */
export interface AnthropicSDKConfig {
  /**
   * Streaming mode for stream responses.
   * @default 'delta'
   */
  streamMode?: StreamMode;
}

// ============================================================================
// Anthropic SDK Wrapper Implementation
// ============================================================================

/**
 * Messages interface (mimics Anthropic SDK).
 */
export class Messages {
  private backend: BackendAdapter;
  private config: AnthropicSDKConfig;

  constructor(backend: BackendAdapter, config: AnthropicSDKConfig = {}) {
    this.backend = backend;
    this.config = config;
  }

  /**
   * Create a message (non-streaming).
   */
  async create(params: AnthropicMessageParams & { stream?: false | undefined }): Promise<AnthropicSDKMessageResponse>;

  /**
   * Create a message (streaming).
   */
  create(params: AnthropicMessageParams & { stream: true }): AsyncIterable<AnthropicStreamEvent>;

  /**
   * Create a message.
   */
  create(params: AnthropicMessageParams): Promise<AnthropicSDKMessageResponse> | AsyncIterable<AnthropicStreamEvent> {
    if (params.stream) {
      return this.createStream(params);
    }
    return this.createNonStream(params);
  }

  private async createNonStream(params: AnthropicMessageParams): Promise<AnthropicSDKMessageResponse> {
    // Convert to IR request
    const messages: IRMessage[] = [];

    // Add system message if present
    if (params.system) {
      messages.push({ role: 'system', content: params.system });
    }

    // Add user/assistant messages
    messages.push(...params.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })));

    const request: IRChatRequest = {
      messages,
      parameters: {
        model: params.model,
        temperature: params.temperature,
        maxTokens: params.max_tokens,
        topP: params.top_p,
        topK: params.top_k,
        stopSequences: params.stop_sequences,
      },
      stream: false,
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
        provenance: {
          frontend: 'anthropic-sdk-wrapper',
        },
      },
    };

    // Execute via backend
    const response = await this.backend.execute(request);

    // Convert to Anthropic format
    const content = typeof response.message.content === 'string'
      ? response.message.content
      : response.message.content.map((c) => (c.type === 'text' ? c.text : '')).join('');

    return {
      id: (response.metadata?.providerResponseId || response.metadata?.requestId) || crypto.randomUUID(),
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: content }],
      model: params.model,
      stop_reason: this.mapFinishReason(response.finishReason),
      stop_sequence: null,
      usage: {
        input_tokens: response.usage?.promptTokens || 0,
        output_tokens: response.usage?.completionTokens || 0,
      },
    };
  }

  private async *createStream(params: AnthropicMessageParams): AsyncIterable<AnthropicStreamEvent> {
    // Convert to IR request
    const messages: IRMessage[] = [];

    if (params.system) {
      messages.push({ role: 'system', content: params.system });
    }

    messages.push(...params.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })));

    const requestId = crypto.randomUUID();

    const request: IRChatRequest = {
      messages,
      parameters: {
        model: params.model,
        temperature: params.temperature,
        maxTokens: params.max_tokens,
        topP: params.top_p,
        topK: params.top_k,
        stopSequences: params.stop_sequences,
      },
      stream: true,
      streamMode: this.config.streamMode,
      metadata: {
        requestId,
        timestamp: Date.now(),
        provenance: {
          frontend: 'anthropic-sdk-wrapper',
        },
      },
    };

    // Execute via backend
    const stream = this.backend.executeStream(request);

    // Emit message_start
    yield {
      type: 'message_start',
      message: {
        id: requestId,
        type: 'message',
        role: 'assistant',
        model: params.model,
      },
    };

    // Emit content_block_start
    yield {
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '' },
    };

    for await (const chunk of stream) {
      if (chunk.type === 'content' && typeof chunk.delta === 'string') {
        yield {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: chunk.delta },
        };
      } else if (chunk.type === 'done') {
        // Emit content_block_stop
        yield {
          type: 'content_block_stop',
          index: 0,
        };

        // Emit message_delta
        yield {
          type: 'message_delta',
          delta: {
            stop_reason: this.mapFinishReason(chunk.finishReason),
            stop_sequence: null,
          },
          usage: {
            output_tokens: chunk.usage?.completionTokens || 0,
          },
        };

        // Emit message_stop
        yield {
          type: 'message_stop',
        };
      }
    }
  }

  private mapFinishReason(reason: string): 'end_turn' | 'max_tokens' | 'stop_sequence' | null {
    switch (reason) {
      case 'stop': return 'end_turn';
      case 'length': return 'max_tokens';
      default: return null;
    }
  }
}

/**
 * Models interface (mimics Anthropic SDK style).
 *
 * Note: The real Anthropic SDK doesn't have a models API,
 * but this provides a useful way to discover available models.
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
   * @returns List of models in Anthropic-style format
   */
  async list(options?: ListModelsOptions): Promise<AnthropicModelsResponse> {
    // Check if backend supports model listing
    if (!this.backend.listModels) {
      // Return empty list if backend doesn't support it
      return {
        data: [],
        has_more: false,
        first_id: null,
        last_id: null,
      };
    }

    // Get models from backend
    const result: ListModelsResult = await this.backend.listModels(options);

    // Convert to Anthropic format
    const data: AnthropicModel[] = result.models.map((model: AIModel) => ({
      id: model.id,
      display_name: model.name,
      created_at: model.created || new Date(result.fetchedAt).toISOString(),
    }));

    return {
      data,
      has_more: false,
      first_id: data.length > 0 ? data[0]!.id : null,
      last_id: data.length > 0 ? data[data.length - 1]!.id : null,
    };
  }

  /**
   * Retrieve information about a specific model.
   *
   * @param modelId - Model identifier
   * @returns Model information in Anthropic format
   */
  async retrieve(modelId: string): Promise<AnthropicModel | null> {
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

    // Convert to Anthropic format
    return {
      id: model.id,
      display_name: model.name,
      created_at: model.created || new Date(result.fetchedAt).toISOString(),
    };
  }
}

/**
 * Anthropic SDK-compatible client.
 */
export class AnthropicClient {
  readonly messages: Messages;
  readonly models: Models;

  constructor(backend: BackendAdapter, config: AnthropicSDKConfig = {}) {
    this.messages = new Messages(backend, config);
    this.models = new Models(backend);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an Anthropic SDK-compatible client using any backend adapter.
 *
 * @example
 * ```typescript
 * import { Anthropic } from 'ai.matey/wrappers/anthropic-sdk';
 * import { OpenAIBackendAdapter } from 'ai.matey';
 *
 * const backend = new OpenAIBackendAdapter({ apiKey: 'sk-...' });
 * const client = Anthropic(backend);
 *
 * const message = await client.messages.create({
 *   model: 'gpt-4o',
 *   max_tokens: 1024,
 *   messages: [
 *     { role: 'user', content: 'Hello, Claude!' }
 *   ],
 * });
 *
 * console.log(message.content[0].text);
 * ```
 */
export function Anthropic(backend: BackendAdapter, config?: AnthropicSDKConfig): AnthropicClient {
  return new AnthropicClient(backend, config);
}
