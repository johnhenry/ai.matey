/**
 * Cloudflare Workers AI Backend Adapter
 *
 * Adapts Universal IR to Cloudflare Workers AI Chat Completions API.
 * Cloudflare is OpenAI-compatible with edge computing and neuron-based pricing.
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
import {
  AdapterConversionError,
  NetworkError,
  ProviderError,
  StreamError,
  ErrorCode,
  createErrorFromHttpResponse,
} from 'ai.matey.errors';
import { normalizeSystemMessages } from 'ai.matey.utils';
import { getEffectiveStreamMode, mergeStreamingConfig } from 'ai.matey.utils';

// ============================================================================
// Cloudflare Workers AI API Types (OpenAI-compatible)
// ============================================================================

export type CloudflareMessageContent =
  | string
  | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;

export interface CloudflareMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: CloudflareMessageContent;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface CloudflareRequest {
  model: string;
  messages: CloudflareMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  stream?: boolean;
}

export interface CloudflareResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: CloudflareMessage;
    finish_reason: 'stop' | 'length' | 'tool_calls' | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface CloudflareStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
    };
    finish_reason: 'stop' | 'length' | null;
  }>;
}

export interface CloudflareConfig extends BackendAdapterConfig {
  accountId?: string; // Cloudflare account ID
}

// ============================================================================
// Cloudflare Workers AI Backend Adapter
// ============================================================================

/**
 * Backend adapter for Cloudflare Workers AI Chat Completions API.
 *
 * Features:
 * - OpenAI-compatible API
 * - Edge computing platform
 * - Vision model support
 * - Function calling support
 * - Neuron-based pricing (pay per inference, not per token)
 * - Global edge network for low latency
 */
export class CloudflareBackendAdapter
  implements BackendAdapter<CloudflareRequest, CloudflareResponse>
{
  readonly metadata: AdapterMetadata;
  private readonly config: CloudflareConfig;
  private readonly accountId: string;
  private readonly baseURL: string;

  constructor(config: CloudflareConfig) {
    this.config = config;

    // Extract Cloudflare-specific config
    this.accountId = config.accountId || '';

    // Construct base URL from account ID or use provided baseURL
    if (config.baseURL) {
      this.baseURL = config.baseURL;
    } else if (this.accountId) {
      this.baseURL = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/v1`;
    } else {
      throw new AdapterConversionError({
        code: ErrorCode.ADAPTER_CONVERSION_ERROR,
        message: 'Cloudflare Workers AI requires either baseURL or accountId in config',
        provenance: { backend: 'cloudflare-backend' },
      });
    }

    this.metadata = {
      name: 'cloudflare-backend',
      version: '1.0.0',
      provider: 'Cloudflare Workers AI',
      capabilities: {
        streaming: true,
        multiModal: true, // Vision models available
        tools: true, // Function calling
        maxContextTokens: 128000,
        systemMessageStrategy: 'in-messages',
        supportsMultipleSystemMessages: true,
        supportsTemperature: true,
        supportsTopP: true,
        supportsTopK: false,
        supportsSeed: false,
        supportsFrequencyPenalty: true,
        supportsPresencePenalty: true,
        maxStopSequences: 4,
      },
      config: {
        baseURL: this.baseURL,
        accountId: this.accountId,
      },
    };
  }

  /**
   * Convert IR to Cloudflare format.
   */
  public fromIR(request: IRChatRequest): CloudflareRequest {
    const { messages } = normalizeSystemMessages(
      request.messages,
      this.metadata.capabilities.systemMessageStrategy,
      this.metadata.capabilities.supportsMultipleSystemMessages
    );

    const cloudflareMessages: CloudflareMessage[] = messages.map((msg) => ({
      role: msg.role,
      content:
        typeof msg.content === 'string'
          ? msg.content
          : msg.content.map((block) => {
              if (block.type === 'text') {
                return { type: 'text', text: block.text };
              } else if (block.type === 'image') {
                return {
                  type: 'image_url',
                  image_url: {
                    url:
                      block.source.type === 'url'
                        ? block.source.url
                        : `data:${block.source.mediaType};base64,${block.source.data}`,
                  },
                };
              }
              return { type: 'text', text: JSON.stringify(block) };
            }),
    }));

    return {
      model:
        request.parameters?.model || this.config.defaultModel || '@cf/meta/llama-3.1-8b-instruct',
      messages: cloudflareMessages,
      temperature: request.parameters?.temperature,
      max_tokens: request.parameters?.maxTokens,
      top_p: request.parameters?.topP,
      frequency_penalty: request.parameters?.frequencyPenalty,
      presence_penalty: request.parameters?.presencePenalty,
      stop: request.parameters?.stopSequences ? [...request.parameters.stopSequences] : undefined,
      stream: request.stream || false,
    };
  }

  /**
   * Convert Cloudflare response to IR.
   */
  public toIR(
    response: CloudflareResponse,
    originalRequest: IRChatRequest,
    latencyMs: number
  ): IRChatResponse {
    const choice = response.choices[0];
    if (!choice) {
      throw new ProviderError({
        code: ErrorCode.PROVIDER_ERROR,
        message: 'No choices returned in response',
        isRetryable: false,
        provenance: { backend: this.metadata.name },
      });
    }

    const message: IRMessage = {
      role: choice.message.role === 'assistant' ? 'assistant' : 'user',
      content:
        typeof choice.message.content === 'string'
          ? choice.message.content
          : choice.message.content.map((c: any) => (c.type === 'text' ? c.text : '')).join(''),
    };

    const finishReasonMap: Record<string, FinishReason> = {
      stop: 'stop',
      length: 'length',
      tool_calls: 'tool_calls',
    };

    return {
      message,
      finishReason: finishReasonMap[choice.finish_reason || 'stop'] || 'stop',
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
          latencyMs,
        },
      },
      raw: response as unknown as Record<string, unknown>,
    };
  }

  /**
   * Execute non-streaming request.
   */
  async execute(request: IRChatRequest, signal?: AbortSignal): Promise<IRChatResponse> {
    try {
      const cloudflareRequest = this.fromIR(request);
      cloudflareRequest.stream = false;

      const startTime = Date.now();
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(cloudflareRequest),
        signal,
      });

      if (!response.ok) {
        throw createErrorFromHttpResponse(
          response.status,
          response.statusText,
          await response.text(),
          { backend: this.metadata.name }
        );
      }

      const data = (await response.json()) as CloudflareResponse;
      return this.toIR(data, request, Date.now() - startTime);
    } catch (error) {
      if (error instanceof NetworkError || error instanceof ProviderError) {
        throw error;
      }

      throw new ProviderError({
        code: ErrorCode.PROVIDER_ERROR,
        message: `Cloudflare Workers AI request failed: ${error instanceof Error ? error.message : String(error)}`,
        isRetryable: true,
        provenance: { backend: this.metadata.name },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Execute streaming request.
   */
  async *executeStream(request: IRChatRequest, signal?: AbortSignal): IRChatStream {
    try {
      const cloudflareRequest = this.fromIR(request);
      cloudflareRequest.stream = true;

      const streamingConfig = mergeStreamingConfig(this.config.streaming);
      const effectiveMode = getEffectiveStreamMode(request.streamMode, undefined, streamingConfig);
      const includeBoth = streamingConfig.includeBoth || effectiveMode === 'accumulated';

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(cloudflareRequest),
        signal,
      });

      if (!response.ok) {
        throw createErrorFromHttpResponse(
          response.status,
          response.statusText,
          await response.text(),
          { backend: this.metadata.name }
        );
      }

      if (!response.body) {
        throw new StreamError({
          code: ErrorCode.STREAM_ERROR,
          message: 'No response body',
          provenance: { backend: this.metadata.name },
        });
      }

      let sequence = 0;
      let contentBuffer = '';

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

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data: ')) {
              continue;
            }

            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              continue;
            }

            try {
              const chunk = JSON.parse(data) as CloudflareStreamChunk;
              const delta = chunk.choices[0]?.delta?.content;

              if (delta) {
                contentBuffer += delta;

                const contentChunk: IRStreamChunk = {
                  type: 'content',
                  sequence: sequence++,
                  delta: delta,
                  role: 'assistant',
                };

                if (includeBoth) {
                  (contentChunk as any).accumulated = contentBuffer;
                }

                yield contentChunk;
              }

              if (chunk.choices[0]?.finish_reason) {
                const finishReasonMap: Record<string, FinishReason> = {
                  stop: 'stop',
                  length: 'length',
                };

                yield {
                  type: 'done',
                  sequence: sequence++,
                  finishReason: finishReasonMap[chunk.choices[0].finish_reason] || 'stop',
                  message: { role: 'assistant', content: contentBuffer },
                } as IRStreamChunk;
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE chunk:', data, parseError);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
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
   * Get HTTP headers.
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
    };

    return { ...headers, ...this.config.headers };
  }

  /**
   * Health check.
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
   * Estimate cost.
   * Cloudflare uses neuron-based pricing (per inference, not per token).
   * Approximate cost based on model size.
   */
  estimateCost(request: IRChatRequest): Promise<number | null> {
    const neuronPricing: Record<string, number> = {
      '@cf/meta/llama-3.1-8b-instruct': 0.01, // Small models: ~$0.01 per 1K neurons
      '@cf/meta/llama-3.1-70b-instruct': 0.1, // Large models: ~$0.10 per 1K neurons
      '@cf/microsoft/phi-2': 0.005, // Tiny models: ~$0.005 per 1K neurons
    };

    const model = request.parameters?.model || this.config.defaultModel || '';
    const costPerNeuron = neuronPricing[model];

    if (!costPerNeuron) {
      return Promise.resolve(null);
    }

    // Rough approximation: 1 neuron ≈ 1 token
    const inputTokens = request.messages.reduce((sum, msg) => {
      const content = typeof msg.content === 'string' ? msg.content : '';
      return sum + Math.ceil(content.length / 4);
    }, 0);

    const outputTokens = request.parameters?.maxTokens || 1024;
    const totalNeurons = inputTokens + outputTokens;

    return Promise.resolve((totalNeurons / 1000) * costPerNeuron);
  }
}
