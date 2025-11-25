/**
 * Anthropic SDK Wrapper
 *
 * Mimics the Anthropic SDK interface using any backend adapter.
 * Allows you to use Anthropic SDK-style code with any provider.
 *
 * @module
 */

import type { BackendAdapter, IRChatRequest, IRMessage, StreamMode, AIModel, ListModelsOptions, ListModelsResult } from 'ai.matey.types';

// ============================================================================
// Anthropic SDK Compatible Types
// ============================================================================

export interface AnthropicSDKMessage {
  role: 'user' | 'assistant';
  content: string;
}

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

export interface AnthropicContentBlock {
  type: 'text';
  text: string;
}

export interface AnthropicSDKUsage {
  input_tokens: number;
  output_tokens: number;
}

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

export interface AnthropicMessageStart {
  type: 'message_start';
  message: Partial<AnthropicSDKMessageResponse>;
}

export interface AnthropicContentBlockStart {
  type: 'content_block_start';
  index: number;
  content_block: { type: 'text'; text: '' };
}

export interface AnthropicContentBlockDelta {
  type: 'content_block_delta';
  index: number;
  delta: { type: 'text_delta'; text: string };
}

export interface AnthropicContentBlockStop {
  type: 'content_block_stop';
  index: number;
}

export interface AnthropicMessageDelta {
  type: 'message_delta';
  delta: {
    stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | null;
    stop_sequence?: string | null;
  };
  usage: { output_tokens: number };
}

export interface AnthropicMessageStop {
  type: 'message_stop';
}

export type AnthropicStreamEvent =
  | AnthropicMessageStart
  | AnthropicContentBlockStart
  | AnthropicContentBlockDelta
  | AnthropicContentBlockStop
  | AnthropicMessageDelta
  | AnthropicMessageStop;

export interface AnthropicModel {
  id: string;
  display_name: string;
  created_at: string;
}

export interface AnthropicModelsResponse {
  data: AnthropicModel[];
  has_more: boolean;
  first_id: string | null;
  last_id: string | null;
}

export interface AnthropicSDKConfig {
  streamMode?: StreamMode;
}

// ============================================================================
// Messages Implementation
// ============================================================================

export class Messages {
  private backend: BackendAdapter;
  private config: AnthropicSDKConfig;

  constructor(backend: BackendAdapter, config: AnthropicSDKConfig = {}) {
    this.backend = backend;
    this.config = config;
  }

  async create(params: AnthropicMessageParams & { stream?: false | undefined }): Promise<AnthropicSDKMessageResponse>;
  create(params: AnthropicMessageParams & { stream: true }): AsyncIterable<AnthropicStreamEvent>;
  create(params: AnthropicMessageParams): Promise<AnthropicSDKMessageResponse> | AsyncIterable<AnthropicStreamEvent> {
    if (params.stream) {
      return this.createStream(params);
    }
    return this.createNonStream(params);
  }

  private async createNonStream(params: AnthropicMessageParams): Promise<AnthropicSDKMessageResponse> {
    const messages: IRMessage[] = [];

    if (params.system) {
      messages.push({ role: 'system', content: params.system });
    }

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
        provenance: { frontend: 'anthropic-sdk-wrapper' },
      },
    };

    const response = await this.backend.execute(request);

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
        provenance: { frontend: 'anthropic-sdk-wrapper' },
      },
    };

    const stream = this.backend.executeStream(request);

    yield {
      type: 'message_start',
      message: { id: requestId, type: 'message', role: 'assistant', model: params.model },
    };

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
        yield { type: 'content_block_stop', index: 0 };
        yield {
          type: 'message_delta',
          delta: { stop_reason: this.mapFinishReason(chunk.finishReason), stop_sequence: null },
          usage: { output_tokens: chunk.usage?.completionTokens || 0 },
        };
        yield { type: 'message_stop' };
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

// ============================================================================
// Models Implementation
// ============================================================================

export class Models {
  private backend: BackendAdapter;

  constructor(backend: BackendAdapter) {
    this.backend = backend;
  }

  async list(options?: ListModelsOptions): Promise<AnthropicModelsResponse> {
    if (!this.backend.listModels) {
      return { data: [], has_more: false, first_id: null, last_id: null };
    }

    const result: ListModelsResult = await this.backend.listModels(options);

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

  async retrieve(modelId: string): Promise<AnthropicModel | null> {
    if (!this.backend.listModels) return null;

    const result: ListModelsResult = await this.backend.listModels();
    const model = result.models.find((m: AIModel) => m.id === modelId);
    if (!model) return null;

    return {
      id: model.id,
      display_name: model.name,
      created_at: model.created || new Date(result.fetchedAt).toISOString(),
    };
  }
}

// ============================================================================
// Client
// ============================================================================

export class AnthropicClient {
  readonly messages: Messages;
  readonly models: Models;

  constructor(backend: BackendAdapter, config: AnthropicSDKConfig = {}) {
    this.messages = new Messages(backend, config);
    this.models = new Models(backend);
  }
}

/**
 * Create an Anthropic SDK-compatible client using any backend adapter.
 */
export function Anthropic(backend: BackendAdapter, config?: AnthropicSDKConfig): AnthropicClient {
  return new AnthropicClient(backend, config);
}
