/**
 * Anthropic Backend Adapter
 *
 * Adapts Universal IR to Anthropic Messages API.
 * Handles Anthropic's separate system parameter and SSE streaming format.
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
  FinishReason,
  MessageContent,
} from '../../types/ir.js';
import type {
  AIModel,
  ListModelsOptions,
  ListModelsResult,
} from '../../types/models.js';
import {
  AdapterConversionError,
  NetworkError,
  ProviderError,
  StreamError,
  ErrorCode,
  createErrorFromHttpResponse,
} from '../../errors/index.js';
import { normalizeSystemMessages } from '../../utils/system-message.js';
import {
  getEffectiveStreamMode,
  mergeStreamingConfig,
} from '../../utils/streaming-modes.js';

// ============================================================================
// Anthropic API Types
// ============================================================================

/**
 * Anthropic message content block.
 */
export type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'url'; url: string } | { type: 'base64'; media_type: string; data: string } }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string | { type: 'text'; text: string }[] };

/**
 * Anthropic message.
 */
export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

/**
 * Anthropic Messages API request.
 */
export interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  system?: string;
  max_tokens: number;
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
 * Anthropic Messages API response.
 */
export interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null;
  stop_sequence?: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Anthropic SSE stream event.
 */
export type AnthropicStreamEvent =
  | { type: 'message_start'; message: { id: string; type: 'message'; role: 'assistant'; model: string; usage: { input_tokens: number; output_tokens: number } } }
  | { type: 'content_block_start'; index: number; content_block: AnthropicContentBlock }
  | { type: 'ping' }
  | { type: 'content_block_delta'; index: number; delta: { type: 'text_delta'; text: string } | { type: 'input_json_delta'; partial_json: string } }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_delta'; delta: { stop_reason: string; stop_sequence?: string | null }; usage: { output_tokens: number } }
  | { type: 'message_stop' }
  | { type: 'error'; error: { type: string; message: string } };

// ============================================================================
// Default Anthropic Models
// ============================================================================

/**
 * Default list of Anthropic Claude models.
 * Used when no custom model list is provided in config.
 */
const DEFAULT_ANTHROPIC_MODELS: readonly AIModel[] = [
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet (Oct 2024)',
    description: 'Most intelligent model with excellent reasoning and analysis',
    ownedBy: 'anthropic',
    capabilities: {
      maxTokens: 8192,
      contextWindow: 200000,
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
      supportsJSON: false,
    },
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku (Oct 2024)',
    description: 'Fastest and most compact model for high-throughput tasks',
    ownedBy: 'anthropic',
    capabilities: {
      maxTokens: 8192,
      contextWindow: 200000,
      supportsStreaming: true,
      supportsVision: false,
      supportsTools: true,
      supportsJSON: false,
    },
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus (Feb 2024)',
    description: 'Previous top-tier model with strong performance',
    ownedBy: 'anthropic',
    capabilities: {
      maxTokens: 4096,
      contextWindow: 200000,
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
      supportsJSON: false,
    },
  },
  {
    id: 'claude-3-sonnet-20240229',
    name: 'Claude 3 Sonnet (Feb 2024)',
    description: 'Balanced intelligence and speed',
    ownedBy: 'anthropic',
    capabilities: {
      maxTokens: 4096,
      contextWindow: 200000,
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
      supportsJSON: false,
    },
  },
  {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku (Mar 2024)',
    description: 'Fast and compact model',
    ownedBy: 'anthropic',
    capabilities: {
      maxTokens: 4096,
      contextWindow: 200000,
      supportsStreaming: true,
      supportsVision: false,
      supportsTools: false,
      supportsJSON: false,
    },
  },
] as const;

// ============================================================================
// Anthropic Backend Adapter
// ============================================================================

/**
 * Backend adapter for Anthropic Messages API.
 */
export class AnthropicBackendAdapter implements BackendAdapter<AnthropicRequest, AnthropicResponse> {
  readonly metadata: AdapterMetadata;
  private readonly config: BackendAdapterConfig;
  private readonly baseURL: string;

  constructor(config: BackendAdapterConfig) {
    this.config = config;
    this.baseURL = config.baseURL || 'https://api.anthropic.com/v1';
    this.metadata = {
      name: 'anthropic-backend',
      version: '1.0.0',
      provider: 'Anthropic',
      capabilities: {
        streaming: true,
        multiModal: true,
        tools: true,
        maxContextTokens: 200000,
        systemMessageStrategy: 'separate-parameter',
        supportsMultipleSystemMessages: false, // Anthropic merges multiple system messages
        supportsTemperature: true,
        supportsTopP: true,
        supportsTopK: true,
        supportsSeed: false,
        supportsFrequencyPenalty: false,
        supportsPresencePenalty: false,
        maxStopSequences: 4,
      },
      config: {
        baseURL: this.baseURL,
      },
    };
  }

  /**
   * Execute non-streaming chat completion request.
   */
  async execute(request: IRChatRequest, signal?: AbortSignal): Promise<IRChatResponse> {
    try {
      // Convert IR to Anthropic format
      const anthropicRequest = this.fromIR(request);

      // Make HTTP request
      const startTime = Date.now();
      const response = await this.makeRequest(anthropicRequest, signal);

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
        message: `Anthropic request failed: ${error instanceof Error ? error.message : String(error)}`,
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
      // Convert IR to Anthropic format
      const anthropicRequest = this.fromIR(request);
      anthropicRequest.stream = true;

      // Get effective streaming configuration
      const streamingConfig = mergeStreamingConfig(this.config.streaming);
      const effectiveMode = getEffectiveStreamMode(
        request.streamMode,
        undefined,
        streamingConfig
      );
      const includeBoth = streamingConfig.includeBoth || effectiveMode === 'accumulated';

      // Make streaming HTTP request
      const response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(anthropicRequest),
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
      let messageId = '';
      let model = '';
      let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;

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
            // Parse SSE format: "event: <type>" or "data: <json>"
            if (line.startsWith('event:')) {
              // Event type line (Anthropic doesn't always use this)
              continue;
            }

            if (line.startsWith('data:')) {
              const data = line.slice(5).trim();

              if (!data) continue;

              try {
                const event: AnthropicStreamEvent = JSON.parse(data);

                // Handle different event types
                switch (event.type) {
                  case 'message_start':
                    // Extract message ID and model
                    messageId = event.message.id;
                    model = event.message.model;
                    usage = {
                      promptTokens: event.message.usage.input_tokens,
                      completionTokens: 0,
                      totalTokens: event.message.usage.input_tokens,
                    };

                    // Yield start chunk
                    yield {
                      type: 'start',
                      sequence: sequence++,
                      metadata: {
                        ...request.metadata,
                        requestId: messageId,
                        provenance: {
                          ...request.metadata.provenance,
                          backend: this.metadata.name,
                        },
                        custom: {
                          ...request.metadata.custom,
                          anthropicMessageId: messageId,
                          model,
                        },
                      },
                    } as IRStreamChunk;
                    break;

                  case 'content_block_start':
                    // Content block started (we'll handle deltas)
                    break;

                  case 'content_block_delta':
                    // Content delta
                    if (event.delta.type === 'text_delta') {
                      contentBuffer += event.delta.text;

                      // Build content chunk with optional accumulated field
                      const contentChunk: IRStreamChunk = {
                        type: 'content',
                        sequence: sequence++,
                        delta: event.delta.text,
                        role: 'assistant',
                      };

                      // Add accumulated field if configured
                      if (includeBoth) {
                        (contentChunk as any).accumulated = contentBuffer;
                      }

                      yield contentChunk;
                    } else if (event.delta.type === 'input_json_delta') {
                      // Tool use delta (not implemented yet)
                      // TODO: Handle tool use deltas in Phase 5
                    }
                    break;

                  case 'content_block_stop':
                    // Content block completed
                    break;

                  case 'message_delta':
                    // Message metadata delta (stop reason, usage)
                    if (event.delta.stop_reason && usage) {
                      usage.completionTokens = event.usage.output_tokens;
                      usage.totalTokens = usage.promptTokens + event.usage.output_tokens;
                    }
                    break;

                  case 'message_stop':
                    // Stream complete
                    const finishReason = this.mapStopReason(contentBuffer ? 'end_turn' : 'stop');

                    // Build final message
                    const message: IRMessage = {
                      role: 'assistant',
                      content: contentBuffer,
                    };

                    yield {
                      type: 'done',
                      sequence: sequence++,
                      finishReason,
                      usage,
                      message,
                    } as IRStreamChunk;
                    break;

                  case 'ping':
                    // Keep-alive ping, ignore
                    break;

                  case 'error':
                    // Error event
                    yield {
                      type: 'error',
                      sequence: sequence++,
                      error: {
                        code: event.error.type,
                        message: event.error.message,
                      },
                    } as IRStreamChunk;
                    break;
                }
              } catch (parseError) {
                // Skip malformed chunks
                console.warn('Failed to parse SSE event:', data, parseError);
                continue;
              }
            }
          }
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
   * Health check to verify Anthropic API is accessible.
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Anthropic doesn't have a dedicated health endpoint
      // We'll try a minimal request to verify auth
      const response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }],
        }),
        signal: AbortSignal.timeout(5000),
      });
      return response.ok || response.status === 400; // 400 is acceptable (validation error)
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
    // Rough cost: $0.015 per 1000 tokens for Claude 3.5 Sonnet
    return (estimatedTokens / 1000) * 0.015;
  }

  /**
   * List available Anthropic models.
   *
   * Since Anthropic doesn't have a public models endpoint, this uses:
   * 1. Static config (config.models) - if provided
   * 2. Default model list - built-in list of Claude models
   */
  async listModels(options?: ListModelsOptions): Promise<ListModelsResult> {
    // 1. Check static config first
    if (this.config.models) {
      return this.buildStaticResult(this.config.models);
    }

    // 2. Use default Anthropic models
    const result: ListModelsResult = {
      models: [...DEFAULT_ANTHROPIC_MODELS],
      source: 'static',
      fetchedAt: Date.now(),
      isComplete: true,
    };

    // 3. Apply filter if requested
    return this.applyModelFilter(result, options?.filter);
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Convert IR request to Anthropic format.
   *
   * Public method for testing and debugging - see what will be sent to Anthropic.
   */
  public fromIR(request: IRChatRequest): AnthropicRequest {
    try {
      // Normalize system messages (Anthropic uses separate-parameter strategy)
      const { systemParameter, messages } = normalizeSystemMessages(
        request.messages,
        this.metadata.capabilities.systemMessageStrategy,
        this.metadata.capabilities.supportsMultipleSystemMessages
      );

      // Convert messages
      const anthropicMessages: AnthropicMessage[] = messages.map((msg) => this.convertMessageToAnthropic(msg));

      // Validate max_tokens is present (required by Anthropic)
      const maxTokens = request.parameters?.maxTokens || 4096;

      // Build Anthropic request
      const anthropicRequest: AnthropicRequest = {
        model: request.parameters?.model || this.config.defaultModel || 'claude-3-5-sonnet-20241022',
        messages: anthropicMessages,
        system: systemParameter || undefined,
        max_tokens: maxTokens,
        temperature: request.parameters?.temperature,
        top_p: request.parameters?.topP,
        top_k: request.parameters?.topK,
        stop_sequences: request.parameters?.stopSequences
          ? [...request.parameters.stopSequences].slice(0, 4) // Anthropic max is 4
          : undefined,
        stream: request.stream,
        metadata: request.metadata.custom?.userId
          ? { user_id: String(request.metadata.custom.userId) }
          : undefined,
      };

      return anthropicRequest;
    } catch (error) {
      throw new AdapterConversionError({
        code: ErrorCode.ADAPTER_CONVERSION_ERROR,
        message: `Failed to convert IR to Anthropic format: ${error instanceof Error ? error.message : String(error)}`,
        provenance: {
          backend: this.metadata.name,
        },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Convert Anthropic response to IR format.
   *
   * Public method for testing and debugging - parse Anthropic responses manually.
   */
  public toIR(
    response: AnthropicResponse,
    originalRequest: IRChatRequest,
    latencyMs: number
  ): IRChatResponse {
    try {
      // Extract text content from content blocks
      let textContent = '';
      const contentBlocks: MessageContent[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          textContent += block.text;
          contentBlocks.push({ type: 'text', text: block.text });
        } else if (block.type === 'tool_use') {
          contentBlocks.push({
            type: 'tool_use',
            id: block.id,
            name: block.name,
            input: block.input,
          });
        }
      }

      // Build message (use simple string if only text, otherwise structured content)
      const firstBlock = contentBlocks[0];
      const message: IRMessage = {
        role: 'assistant',
        content: contentBlocks.length === 1 && firstBlock?.type === 'text' ? textContent : contentBlocks,
      };

      // Map stop reason
      const finishReason = this.mapStopReason(response.stop_reason || 'end_turn');

      // Build IR response
      const irResponse: IRChatResponse = {
        message,
        finishReason,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        metadata: {
          ...originalRequest.metadata,
          providerResponseId: response.id, // Anthropic's msg_xxx ID
          provenance: {
            ...originalRequest.metadata.provenance,
            backend: this.metadata.name,
          },
          custom: {
            ...originalRequest.metadata.custom,
            anthropicMessageId: response.id,
            latencyMs,
          },
        },
        raw: response as unknown as Record<string, unknown>,
      };

      return irResponse;
    } catch (error) {
      throw new AdapterConversionError({
        code: ErrorCode.ADAPTER_CONVERSION_ERROR,
        message: `Failed to convert Anthropic response to IR: ${error instanceof Error ? error.message : String(error)}`,
        provenance: {
          backend: this.metadata.name,
        },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Convert IR message to Anthropic message.
   */
  private convertMessageToAnthropic(message: IRMessage): AnthropicMessage {
    // Anthropic only supports user/assistant roles (system handled separately)
    if (message.role === 'system') {
      throw new AdapterConversionError({
        code: ErrorCode.ADAPTER_CONVERSION_ERROR,
        message: 'System messages should be extracted before conversion to Anthropic format',
        provenance: {
          backend: this.metadata.name,
        },
      });
    }

    // Convert content
    let content: string | AnthropicContentBlock[];

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
                type: 'image',
                source: { type: 'url', url: block.source.url },
              };
            } else {
              return {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: block.source.mediaType,
                  data: block.source.data,
                },
              };
            }

          case 'tool_use':
            return {
              type: 'tool_use',
              id: block.id,
              name: block.name,
              input: block.input,
            };

          case 'tool_result':
            return {
              type: 'tool_result',
              tool_use_id: block.toolUseId,
              content: typeof block.content === 'string'
                ? block.content
                : block.content.map(c => (c.type === 'text' ? { type: 'text', text: c.text } : { type: 'text', text: '' })),
            };

          default:
            // Fallback to text for unsupported types
            return { type: 'text', text: JSON.stringify(block) };
        }
      });
    }

    return {
      role: message.role as 'user' | 'assistant',
      content,
    };
  }

  /**
   * Map Anthropic stop reason to IR finish reason.
   */
  private mapStopReason(stopReason: string | null): FinishReason {
    switch (stopReason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'stop_sequence':
        return 'stop';
      case 'tool_use':
        return 'tool_calls';
      default:
        return 'stop';
    }
  }

  /**
   * Make HTTP request to Anthropic API.
   */
  private async makeRequest(request: AnthropicRequest, signal?: AbortSignal): Promise<AnthropicResponse> {
    try {
      const response = await fetch(`${this.baseURL}/messages`, {
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

      const data = (await response.json()) as AnthropicResponse;
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
   * Get HTTP headers for Anthropic API requests.
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.config.apiKey,
      'anthropic-version': '2023-06-01',
    };

    // Add dangerous browser access header if browserMode is enabled
    if (this.config.browserMode) {
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    }

    // Merge with custom headers (custom headers can override)
    return { ...headers, ...this.config.headers };
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
          ownedBy: 'anthropic',
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
