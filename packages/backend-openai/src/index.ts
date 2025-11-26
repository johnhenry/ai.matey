/**
 * OpenAI Backend Adapter
 *
 * Adapts Universal IR to OpenAI Chat Completions API.
 * Handles OpenAI's in-messages system message strategy and 0-2 temperature range.
 *
 * @module
 */

import type { BackendAdapter, BackendAdapterConfig, AdapterMetadata } from 'ai.matey.types';
import type {
  IRChatRequest,
  IRChatResponse,
  IRChatStream,
  IRMessage,
  IRStreamChunk,
  FinishReason,
} from 'ai.matey.types';
import type {
  AIModel,
  ListModelsOptions,
  ListModelsResult,
} from 'ai.matey.types';
import {
  AdapterConversionError,
  NetworkError,
  ProviderError,
  StreamError,
  ErrorCode,
  createErrorFromHttpResponse,
} from 'ai.matey.errors';
import { normalizeSystemMessages } from 'ai.matey.utils';
import { getModelCache } from 'ai.matey.utils';
import {
  getEffectiveStreamMode,
  mergeStreamingConfig,
} from 'ai.matey.utils';

// ============================================================================
// OpenAI API Types
// ============================================================================

/**
 * OpenAI message content.
 */
export type OpenAIMessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }
    >;

/**
 * OpenAI message.
 */
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: OpenAIMessageContent;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

/**
 * OpenAI Chat Completions API request.
 */
export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  user?: string;
  seed?: number;
}

/**
 * OpenAI Chat Completions API response.
 */
export interface OpenAIResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: OpenAIMessage;
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI streaming chunk.
 */
export interface OpenAIStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  }>;
}

/**
 * OpenAI model object from /v1/models endpoint.
 */
export interface OpenAIModel {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}

/**
 * OpenAI models list response.
 */
export interface OpenAIModelsResponse {
  object: 'list';
  data: OpenAIModel[];
}

// ============================================================================
// OpenAI Backend Adapter
// ============================================================================

/**
 * Backend adapter for OpenAI Chat Completions API.
 */
export class OpenAIBackendAdapter implements BackendAdapter<OpenAIRequest, OpenAIResponse> {
  readonly metadata: AdapterMetadata;
  protected readonly config: BackendAdapterConfig;
  protected readonly baseURL: string;
  private readonly modelCache: ReturnType<typeof getModelCache>;

  /**
   * Create a new OpenAI backend adapter.
   *
   * @param config Backend adapter configuration
   * @param metadataOverride Optional metadata to override defaults (used by subclasses)
   */
  constructor(config: BackendAdapterConfig, metadataOverride?: Partial<AdapterMetadata>) {
    this.config = config;
    this.baseURL = config.baseURL || 'https://api.openai.com/v1';
    this.modelCache = getModelCache(config.modelsCacheScope || 'global');

    // Default OpenAI metadata
    const defaultMetadata: AdapterMetadata = {
      name: 'openai-backend',
      version: '1.0.0',
      provider: 'OpenAI',
      capabilities: {
        streaming: true,
        multiModal: true,
        tools: true,
        maxContextTokens: 128000,
        systemMessageStrategy: 'in-messages',
        supportsMultipleSystemMessages: false, // OpenAI prefers single system message
        supportsTemperature: true,
        supportsTopP: true,
        supportsTopK: false,
        supportsSeed: true,
        supportsFrequencyPenalty: true,
        supportsPresencePenalty: true,
        maxStopSequences: 4,
      },
      config: {
        baseURL: this.baseURL,
      },
    };

    // Apply metadata overrides if provided (for subclasses)
    this.metadata = metadataOverride
      ? {
          ...defaultMetadata,
          ...metadataOverride,
          capabilities: {
            ...defaultMetadata.capabilities,
            ...metadataOverride.capabilities,
          },
          config: {
            ...defaultMetadata.config,
            ...metadataOverride.config,
          },
        }
      : defaultMetadata;
  }

  /**
   * Execute non-streaming chat completion request.
   */
  async execute(request: IRChatRequest, signal?: AbortSignal): Promise<IRChatResponse> {
    try {
      // Convert IR to OpenAI format
      const openaiRequest = this.fromIR(request);

      // Make HTTP request
      const startTime = Date.now();
      const response = await this.makeRequest(openaiRequest, signal);

      // Convert response to IR
      const irResponse = this.toIR(response, request, Date.now() - startTime);

      return irResponse;
    } catch (error) {
      // Re-throw adapter errors
      if (
        error instanceof AdapterConversionError ||
        error instanceof NetworkError ||
        error instanceof ProviderError
      ) {
        throw error;
      }

      // Wrap unknown errors
      throw new ProviderError({
        code: ErrorCode.PROVIDER_ERROR,
        message: `OpenAI request failed: ${error instanceof Error ? error.message : String(error)}`,
        isRetryable: true,
        provenance: {
          backend: this.metadata.name,
        },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Execute streaming chat completion request.
   */
  async *executeStream(request: IRChatRequest, signal?: AbortSignal): IRChatStream {
    try {
      // Convert IR to OpenAI format
      const openaiRequest = this.fromIR(request);
      openaiRequest.stream = true;

      // Get effective streaming configuration
      const streamingConfig = mergeStreamingConfig(this.config.streaming);
      const effectiveMode = getEffectiveStreamMode(
        request.streamMode,
        undefined,
        streamingConfig
      );
      const includeBoth = streamingConfig.includeBoth || effectiveMode === 'accumulated';

      // Make streaming HTTP request
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(openaiRequest),
        signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw createErrorFromHttpResponse(
          response.status,
          response.statusText,
          errorBody,
          {
            backend: this.metadata.name,
          }
        );
      }

      if (!response.body) {
        throw new StreamError({
          code: ErrorCode.STREAM_INTERRUPTED,
          message: 'Response body is null',
          provenance: {
            backend: this.metadata.name,
          },
        });
      }

      // Parse SSE stream
      let sequence = 0;
      let contentBuffer = '';
      let finishReasonReceived: FinishReason | null = null;
      let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;

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

      // Read stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            // Skip empty lines
            if (!line.trim()) continue;

            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();

              if (data === '[DONE]') {
                // Stream complete - yield done chunk if not already sent
                if (!finishReasonReceived) {
                  const message: IRMessage = {
                    role: 'assistant',
                    content: contentBuffer,
                  };

                  yield {
                    type: 'done',
                    sequence: sequence++,
                    finishReason: 'stop',
                    usage,
                    message,
                  } as IRStreamChunk;
                }
                continue;
              }

              try {
                const chunk: OpenAIStreamChunk = JSON.parse(data);

                // Validate chunk structure
                if (!chunk.choices || chunk.choices.length === 0) {
                  console.warn('Invalid chunk structure: no choices', chunk);
                  continue;
                }

                const choice = chunk.choices[0];
                if (!choice) continue;

                // Content delta
                if (choice.delta.content) {
                  contentBuffer += choice.delta.content;

                  // Build content chunk with optional accumulated field
                  const contentChunk: IRStreamChunk = {
                    type: 'content',
                    sequence: sequence++,
                    delta: choice.delta.content,
                    role: 'assistant',
                  };

                  // Add accumulated field if configured
                  if (includeBoth) {
                    (contentChunk as any).accumulated = contentBuffer;
                  }

                  yield contentChunk;
                }

                // Tool calls delta (not implemented yet - Phase 5)
                if (choice.delta.tool_calls) {
                  // TODO: Handle tool call deltas in Phase 5
                  console.warn('Tool calls delta received but not yet implemented');
                }

                // Finish reason
                if (choice.finish_reason && !finishReasonReceived) {
                  finishReasonReceived = this.mapFinishReason(choice.finish_reason);

                  // Build final message
                  const message: IRMessage = {
                    role: 'assistant',
                    content: contentBuffer,
                  };

                  yield {
                    type: 'done',
                    sequence: sequence++,
                    finishReason: finishReasonReceived,
                    usage,
                    message,
                  } as IRStreamChunk;
                }
              } catch (parseError) {
                // Log parse errors but continue streaming
                console.warn('Failed to parse SSE chunk:', data, parseError);
                continue;
              }
            } else if (line.startsWith('event:')) {
              // OpenAI doesn't typically use event: lines, but handle them
              const eventType = line.slice(6).trim();
              if (eventType === 'error') {
                // Error event type
                console.warn('Error event type detected');
              }
            }
          }
        }

        // If stream ended without finish_reason, yield a done chunk
        if (!finishReasonReceived) {
          const message: IRMessage = {
            role: 'assistant',
            content: contentBuffer,
          };

          yield {
            type: 'done',
            sequence: sequence++,
            finishReason: 'stop',
            usage,
            message,
          } as IRStreamChunk;
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      // Yield error chunk
      yield {
        type: 'error',
        sequence: 0,
        error: {
          code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : String(error),
        },
      } as IRStreamChunk;
    }
  }

  /**
   * Health check to verify OpenAI API is accessible.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/models`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Estimate cost for a request (rough heuristic).
   */
  async estimateCost(request: IRChatRequest): Promise<number | null> {
    // Rough estimation: 4 characters per token
    const estimatedTokens = this.estimateTokens(request);
    // Rough cost: $0.01 per 1000 tokens (varies by model)
    return (estimatedTokens / 1000) * 0.01;
  }

  /**
   * List available models from OpenAI.
   *
   * This method supports three sources:
   * 1. Static config (config.models) - highest priority
   * 2. Cache (if enabled and not expired)
   * 3. Remote API (/v1/models endpoint)
   */
  async listModels(options?: ListModelsOptions): Promise<ListModelsResult> {
    try {
      // 1. Check static config override first
      if (this.config.models && !options?.forceRefresh) {
        return this.buildStaticResult(this.config.models);
      }

      // 2. Check cache
      if (this.config.cacheModels !== false && !options?.forceRefresh) {
        const cached = this.modelCache.get(this.metadata.name);
        if (cached) {
          return this.applyModelFilter(cached, options?.filter);
        }
      }

      // 3. Fetch from OpenAI API
      const endpoint = this.config.modelsEndpoint || `${this.baseURL}/models`;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(this.config.timeout || 30000),
      });

      if (!response.ok) {
        throw createErrorFromHttpResponse(
          response.status,
          response.statusText,
          await response.text(),
          {
            backend: this.metadata.name,
          }
        );
      }

      const data = (await response.json()) as OpenAIModelsResponse;

      // 4. Transform to AIModel format
      const models = data.data.map((model) => this.transformOpenAIModel(model));

      // 5. Build result
      const result: ListModelsResult = {
        models,
        source: 'remote',
        fetchedAt: Date.now(),
        isComplete: true,
      };

      // 6. Cache the result
      if (this.config.cacheModels !== false) {
        const ttl = this.config.modelsCacheTTL || 3600000; // 1 hour default
        this.modelCache.set(this.metadata.name, result, ttl);
      }

      // 7. Apply filter if requested
      return this.applyModelFilter(result, options?.filter);
    } catch (error) {
      // If we have a cached result, return it as fallback
      if (!options?.forceRefresh) {
        const cached = this.modelCache.get(this.metadata.name);
        if (cached) {
          return cached;
        }
      }

      // Re-throw known errors
      if (error instanceof ProviderError || error instanceof NetworkError) {
        throw error;
      }

      // Wrap unknown errors
      throw new ProviderError({
        code: ErrorCode.PROVIDER_ERROR,
        message: `Failed to list OpenAI models: ${error instanceof Error ? error.message : String(error)}`,
        isRetryable: true,
        provenance: {
          backend: this.metadata.name,
        },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Convert IR request to OpenAI format.
   *
   * Public method for testing and debugging - see what will be sent to OpenAI.
   */
  public fromIR(request: IRChatRequest): OpenAIRequest {
    try {
      // Normalize system messages (OpenAI uses in-messages strategy)
      const { messages } = normalizeSystemMessages(
        request.messages,
        this.metadata.capabilities.systemMessageStrategy,
        this.metadata.capabilities.supportsMultipleSystemMessages
      );

      // Convert messages
      const openaiMessages: OpenAIMessage[] = messages.map((msg) => this.convertMessageToOpenAI(msg));

      // Build OpenAI request
      const openaiRequest: OpenAIRequest = {
        model: request.parameters?.model || this.config.defaultModel || 'gpt-3.5-turbo',
        messages: openaiMessages,
        temperature: request.parameters?.temperature,
        max_tokens: request.parameters?.maxTokens,
        top_p: request.parameters?.topP,
        frequency_penalty: request.parameters?.frequencyPenalty,
        presence_penalty: request.parameters?.presencePenalty,
        stop: request.parameters?.stopSequences ? [...request.parameters.stopSequences] : undefined,
        stream: request.stream,
        user: request.parameters?.user,
        seed: request.parameters?.seed,
      };

      return openaiRequest;
    } catch (error) {
      throw new AdapterConversionError({
        code: ErrorCode.ADAPTER_CONVERSION_ERROR,
        message: `Failed to convert IR to OpenAI format: ${error instanceof Error ? error.message : String(error)}`,
        provenance: {
          backend: this.metadata.name,
        },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Convert OpenAI response to IR format.
   *
   * Public method for testing and debugging - parse OpenAI responses manually.
   */
  public toIR(response: OpenAIResponse, originalRequest: IRChatRequest, latencyMs: number): IRChatResponse {
    try {
      const choice = response.choices[0];
      if (!choice) {
        throw new Error('No choices in OpenAI response');
      }

      // Convert message
      const message: IRMessage = {
        role: 'assistant',
        content: this.convertMessageContentFromOpenAI(choice.message.content),
      };

      // Map finish reason
      const finishReason = this.mapFinishReason(choice.finish_reason || 'stop');

      // Build IR response
      const irResponse: IRChatResponse = {
        message,
        finishReason,
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
        metadata: {
          ...originalRequest.metadata,
          providerResponseId: response.id,
          provenance: {
            ...originalRequest.metadata.provenance,
            backend: this.metadata.name,
          },
          custom: {
            ...originalRequest.metadata.custom,
            openaiResponseId: response.id,
            latencyMs,
          },
        },
        raw: response as unknown as Record<string, unknown>,
      };

      return irResponse;
    } catch (error) {
      throw new AdapterConversionError({
        code: ErrorCode.ADAPTER_CONVERSION_ERROR,
        message: `Failed to convert OpenAI response to IR: ${error instanceof Error ? error.message : String(error)}`,
        provenance: {
          backend: this.metadata.name,
        },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Convert IR message to OpenAI message.
   */
  private convertMessageToOpenAI(message: IRMessage): OpenAIMessage {
    // Convert content
    let content: OpenAIMessageContent;

    if (typeof message.content === 'string') {
      content = message.content;
    } else {
      // Convert content blocks
      content = message.content.map((block) => {
        switch (block.type) {
          case 'text':
            return { type: 'text', text: block.text };

          case 'image':
            if (block.source.type === 'url') {
              return {
                type: 'image_url',
                image_url: { url: block.source.url },
              };
            } else {
              // Convert base64 to data URL
              const dataUrl = `data:${block.source.mediaType};base64,${block.source.data}`;
              return {
                type: 'image_url',
                image_url: { url: dataUrl },
              };
            }

          default:
            // Fallback to text for unsupported types
            return { type: 'text', text: JSON.stringify(block) };
        }
      });
    }

    return {
      role: message.role as 'system' | 'user' | 'assistant' | 'tool',
      content,
      name: message.name,
    };
  }

  /**
   * Convert OpenAI message content to string.
   */
  private convertMessageContentFromOpenAI(content: OpenAIMessageContent): string {
    if (typeof content === 'string') {
      return content;
    }

    // Extract text from content blocks
    return content
      .map((block) => {
        if (block.type === 'text') {
          return block.text;
        }
        return '';
      })
      .join('');
  }

  /**
   * Map OpenAI finish reason to IR finish reason.
   */
  private mapFinishReason(finishReason: string | null): FinishReason {
    switch (finishReason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'tool_calls':
        return 'tool_calls';
      case 'content_filter':
        return 'content_filter';
      default:
        return 'stop';
    }
  }

  /**
   * Make HTTP request to OpenAI API.
   */
  private async makeRequest(request: OpenAIRequest, signal?: AbortSignal): Promise<OpenAIResponse> {
    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request),
        signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw createErrorFromHttpResponse(
          response.status,
          response.statusText,
          errorBody,
          {
            backend: this.metadata.name,
          }
        );
      }

      const data = (await response.json()) as OpenAIResponse;
      return data;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError({
          code: ErrorCode.NETWORK_ERROR,
          message: `Network request failed: ${error.message}`,
          provenance: {
            backend: this.metadata.name,
          },
          cause: error,
        });
      }
      throw error;
    }
  }

  /**
   * Get HTTP headers for OpenAI API requests.
   */
  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      ...this.config.headers,
    };
  }

  /**
   * Estimate token count for a request (rough heuristic).
   */
  private estimateTokens(request: IRChatRequest): number {
    let totalChars = 0;

    for (const message of request.messages) {
      if (typeof message.content === 'string') {
        totalChars += message.content.length;
      } else {
        for (const block of message.content) {
          if (block.type === 'text') {
            totalChars += block.text.length;
          }
        }
      }
    }

    // Rough estimate: 4 characters per token
    return Math.ceil(totalChars / 4);
  }

  /**
   * Build model list result from static configuration.
   */
  private buildStaticResult(models: readonly (string | AIModel)[]): ListModelsResult {
    const normalizedModels: AIModel[] = models.map((model) => {
      if (typeof model === 'string') {
        // Convert string ID to AIModel
        return {
          id: model,
          name: model,
          ownedBy: 'openai',
        };
      }
      return model;
    });

    return {
      models: normalizedModels,
      source: 'static',
      fetchedAt: Date.now(),
      isComplete: true,
    };
  }

  /**
   * Transform OpenAI model object to AIModel.
   */
  private transformOpenAIModel(model: OpenAIModel): AIModel {
    return {
      id: model.id,
      name: model.id, // OpenAI doesn't provide separate display names
      created: new Date(model.created * 1000).toISOString(),
      ownedBy: model.owned_by,
      // Note: OpenAI /models endpoint doesn't include capability info
      // This would need to be enriched from a static mapping if needed
    };
  }

  /**
   * Apply capability filter to model list result.
   */
  private applyModelFilter(
    result: ListModelsResult,
    filter?: {
      readonly supportsStreaming?: boolean;
      readonly supportsVision?: boolean;
      readonly supportsTools?: boolean;
      readonly supportsJSON?: boolean;
    }
  ): ListModelsResult {
    if (!filter) {
      return result;
    }

    const filteredModels = result.models.filter((model) => {
      const capabilities = model.capabilities;

      // If no capabilities info, can't filter
      if (!capabilities) {
        return true;
      }

      // Check each filter criterion
      if (filter.supportsStreaming !== undefined && capabilities.supportsStreaming !== filter.supportsStreaming) {
        return false;
      }

      if (filter.supportsVision !== undefined && capabilities.supportsVision !== filter.supportsVision) {
        return false;
      }

      if (filter.supportsTools !== undefined && capabilities.supportsTools !== filter.supportsTools) {
        return false;
      }

      if (filter.supportsJSON !== undefined && capabilities.supportsJSON !== filter.supportsJSON) {
        return false;
      }

      return true;
    });

    return {
      ...result,
      models: filteredModels,
      isComplete: result.isComplete && filteredModels.length === result.models.length,
    };
  }
}
