/**
 * Anthropic SDK Wrapper
 *
 * Mimics the Anthropic SDK interface using any backend adapter.
 * Allows you to use Anthropic SDK-style code with any provider.
 *
 * Uses the Anthropic Frontend Adapter internally for format conversions.
 *
 * @module
 */

import type {
  BackendAdapter,
  StreamMode,
  AIModel,
  ListModelsOptions,
  ListModelsResult,
} from 'ai.matey.types';
import {
  AnthropicFrontendAdapter,
  type AnthropicRequest,
  type AnthropicStreamEvent,
  type AnthropicContentBlock,
} from 'ai.matey.frontend.anthropic';

// ============================================================================
// Re-export types from frontend adapter
// ============================================================================

export type {
  AnthropicRequest,
  AnthropicResponse,
  AnthropicStreamEvent,
  AnthropicMessage,
  AnthropicContentBlock,
} from 'ai.matey.frontend.anthropic';

// ============================================================================
// SDK-style Types (compatibility aliases)
// ============================================================================

/**
 * Anthropic SDK message (alias).
 */
export interface AnthropicSDKMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

/**
 * Anthropic message parameters (SDK style).
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
  metadata?: {
    user_id?: string;
  };
}

/**
 * Anthropic SDK usage information.
 */
export interface AnthropicSDKUsage {
  input_tokens: number;
  output_tokens: number;
}

/**
 * Anthropic SDK message response.
 */
export interface AnthropicSDKMessageResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null;
  stop_sequence: string | null;
  usage: AnthropicSDKUsage;
}

/**
 * Anthropic Model object.
 */
export interface AnthropicModel {
  id: string;
  display_name: string;
  created_at: string;
}

/**
 * Anthropic Models response.
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
// Messages Implementation
// ============================================================================

/**
 * Messages interface (mimics Anthropic SDK).
 */
export class Messages {
  private backend: BackendAdapter;
  private config: AnthropicSDKConfig;
  private adapter: AnthropicFrontendAdapter;

  constructor(backend: BackendAdapter, config: AnthropicSDKConfig = {}) {
    this.backend = backend;
    this.config = config;
    this.adapter = new AnthropicFrontendAdapter();
  }

  /**
   * Create a message (non-streaming).
   */
  async create(
    params: AnthropicMessageParams & { stream?: false | undefined }
  ): Promise<AnthropicSDKMessageResponse>;

  /**
   * Create a message (streaming).
   */
  create(params: AnthropicMessageParams & { stream: true }): AsyncIterable<AnthropicStreamEvent>;

  /**
   * Create a message.
   */
  create(
    params: AnthropicMessageParams
  ): Promise<AnthropicSDKMessageResponse> | AsyncIterable<AnthropicStreamEvent> {
    if (params.stream) {
      return this.createStream(params);
    }
    return this.createNonStream(params);
  }

  private async createNonStream(
    params: AnthropicMessageParams
  ): Promise<AnthropicSDKMessageResponse> {
    // Convert params to Anthropic request format
    const request: AnthropicRequest = {
      model: params.model,
      messages: params.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      max_tokens: params.max_tokens,
      system: params.system,
      temperature: params.temperature,
      top_p: params.top_p,
      top_k: params.top_k,
      stop_sequences: params.stop_sequences,
      stream: false,
      metadata: params.metadata,
    };

    // Use frontend adapter to convert to IR
    const irRequest = await this.adapter.toIR(request);

    // Execute via backend
    const irResponse = await this.backend.execute(irRequest);

    // Use frontend adapter to convert back to Anthropic format
    const anthropicResponse = await this.adapter.fromIR(irResponse);

    // Return in SDK-style format
    return {
      id: anthropicResponse.id,
      type: 'message',
      role: 'assistant',
      content: anthropicResponse.content,
      model: anthropicResponse.model,
      stop_reason: anthropicResponse.stop_reason,
      stop_sequence: anthropicResponse.stop_sequence ?? null,
      usage: anthropicResponse.usage,
    };
  }

  private async *createStream(params: AnthropicMessageParams): AsyncIterable<AnthropicStreamEvent> {
    // Convert params to Anthropic request format
    const request: AnthropicRequest = {
      model: params.model,
      messages: params.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      max_tokens: params.max_tokens,
      system: params.system,
      temperature: params.temperature,
      top_p: params.top_p,
      top_k: params.top_k,
      stop_sequences: params.stop_sequences,
      stream: true,
      metadata: params.metadata,
    };

    // Use frontend adapter to convert to IR
    let irRequest = await this.adapter.toIR(request);

    // Add stream mode if configured
    if (this.config.streamMode) {
      irRequest = { ...irRequest, streamMode: this.config.streamMode };
    }

    // Execute streaming via backend
    const irStream = this.backend.executeStream(irRequest);

    // Use frontend adapter to convert stream
    for await (const event of this.adapter.fromIRStream(irStream)) {
      yield event;
    }
  }
}

// ============================================================================
// Models Implementation
// ============================================================================

/**
 * Models interface (mimics Anthropic SDK).
 */
export class Models {
  private backend: BackendAdapter;

  constructor(backend: BackendAdapter) {
    this.backend = backend;
  }

  /**
   * List available models.
   */
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

    const firstItem = data[0];
    const lastItem = data[data.length - 1];

    return {
      data,
      has_more: false,
      first_id: firstItem?.id ?? null,
      last_id: lastItem?.id ?? null,
    };
  }

  /**
   * Retrieve information about a specific model.
   */
  async retrieve(modelId: string): Promise<AnthropicModel | null> {
    if (!this.backend.listModels) {
      return null;
    }

    const result: ListModelsResult = await this.backend.listModels();
    const model = result.models.find((m: AIModel) => m.id === modelId);
    if (!model) {
      return null;
    }

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
 * import { Anthropic } from 'ai.matey.wrapper.anthropic-sdk';
 * import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';
 *
 * const backend = new OpenAIBackendAdapter({ apiKey: 'sk-...' });
 * const client = Anthropic(backend);
 *
 * const message = await client.messages.create({
 *   model: 'gpt-4',
 *   max_tokens: 1024,
 *   messages: [
 *     { role: 'user', content: 'Hello!' }
 *   ],
 * });
 *
 * console.log(message.content[0].text);
 * ```
 */
export function Anthropic(backend: BackendAdapter, config?: AnthropicSDKConfig): AnthropicClient {
  return new AnthropicClient(backend, config);
}
