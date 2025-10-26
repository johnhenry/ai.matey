/**
 * DeepInfra Backend Adapter
 *
 * Adapts Universal IR to DeepInfra Chat Completions API.
 * DeepInfra is OpenAI-compatible with detailed cost estimation.
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
import { getModelCache } from '../../utils/model-cache.js';
import {
  getEffectiveStreamMode,
  mergeStreamingConfig,
} from '../../utils/streaming-modes.js';

// ============================================================================
// DeepInfra API Types (OpenAI-compatible)
// ============================================================================

export type DeepInfraMessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >;

export interface DeepInfraMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: DeepInfraMessageContent;
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

export interface DeepInfraRequest {
  model: string;
  messages: DeepInfraMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  stream?: boolean;
}

export interface DeepInfraResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: DeepInfraMessage;
    finish_reason: 'stop' | 'length' | 'tool_calls' | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface DeepInfraStreamChunk {
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

// ============================================================================
// DeepInfra Backend Adapter
// ============================================================================

/**
 * Backend adapter for DeepInfra Chat Completions API.
 *
 * Features:
 * - OpenAI-compatible API
 * - Detailed cost estimation
 * - Vision model support
 * - Function calling support
 * - Competitive pricing starting at $0.40 per 1M tokens
 */
export class DeepInfraBackendAdapter implements BackendAdapter<DeepInfraRequest, DeepInfraResponse> {
  readonly metadata: AdapterMetadata;
  private readonly config: BackendAdapterConfig;
  private readonly baseURL: string;
  private readonly modelCache: ReturnType<typeof getModelCache>;

  constructor(config: BackendAdapterConfig) {
    this.config = config;
    this.baseURL = config.baseURL || 'https://api.deepinfra.com/v1/openai';
    this.modelCache = getModelCache(config.modelsCacheScope || 'global');
    this.metadata = {
      name: 'deepinfra-backend',
      version: '1.0.0',
      provider: 'DeepInfra',
      capabilities: {
        streaming: true,
        multiModal: true,  // Vision models available
        tools: true,       // Function calling
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
      },
    };
  }

  /**
   * Convert IR to DeepInfra format.
   */
  public fromIR(request: IRChatRequest): DeepInfraRequest {
    const { messages } = normalizeSystemMessages(
      request.messages,
      this.metadata.capabilities.systemMessageStrategy,
      this.metadata.capabilities.supportsMultipleSystemMessages
    );

    const deepinfraMessages: DeepInfraMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: typeof msg.content === 'string'
        ? msg.content
        : msg.content.map((block) => {
            if (block.type === 'text') {
              return { type: 'text', text: block.text };
            } else if (block.type === 'image') {
              return {
                type: 'image_url',
                image_url: { url: block.source.url || `data:${block.source.mediaType};base64,${block.source.data}` }
              };
            }
            return { type: 'text', text: JSON.stringify(block) };
          }),
    }));

    return {
      model: request.parameters?.model || this.config.defaultModel || 'meta-llama/Meta-Llama-3.1-8B-Instruct',
      messages: deepinfraMessages,
      temperature: request.parameters?.temperature,
      max_tokens: request.parameters?.maxTokens,
      top_p: request.parameters?.topP,
      frequency_penalty: request.parameters?.frequencyPenalty,
      presence_penalty: request.parameters?.presencePenalty,
      stop: request.parameters?.stopSequences,
      stream: request.stream || false,
    };
  }

  /**
   * Convert DeepInfra response to IR.
   */
  public toIR(response: DeepInfraResponse, originalRequest: IRChatRequest, latencyMs: number): IRChatResponse {
    const choice = response.choices[0];

    const message: IRMessage = {
      role: choice.message.role === 'assistant' ? 'assistant' : 'user',
      content: typeof choice.message.content === 'string'
        ? choice.message.content
        : choice.message.content.map((c: any) => c.type === 'text' ? c.text : '').join(''),
    };

    const finishReasonMap: Record<string, FinishReason> = {
      'stop': 'stop',
      'length': 'length',
      'tool_calls': 'tool_calls',
    };

    return {
      message,
      finishReason: finishReasonMap[choice.finish_reason || 'stop'] || 'stop',
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
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
      const deepinfraRequest = this.fromIR(request);
      deepinfraRequest.stream = false;

      const startTime = Date.now();
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(deepinfraRequest),
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

      const data = (await response.json()) as DeepInfraResponse;
      return this.toIR(data, request, Date.now() - startTime);
    } catch (error) {
      if (error instanceof NetworkError || error instanceof ProviderError) {
        throw error;
      }

      throw new ProviderError({
        code: ErrorCode.PROVIDER_ERROR,
        message: `DeepInfra request failed: ${error instanceof Error ? error.message : String(error)}`,
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
      const deepinfraRequest = this.fromIR(request);
      deepinfraRequest.stream = true;

      const streamingConfig = mergeStreamingConfig(this.config.streaming);
      const effectiveMode = getEffectiveStreamMode(
        request.streamMode,
        undefined,
        streamingConfig
      );
      const includeBoth = streamingConfig.includeBoth || effectiveMode === 'accumulated';

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(deepinfraRequest),
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
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data: ')) continue;

            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              const chunk = JSON.parse(data) as DeepInfraStreamChunk;
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
                  'stop': 'stop',
                  'length': 'length',
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
      'Authorization': `Bearer ${this.config.apiKey}`,
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
   * Estimate cost with detailed pricing.
   */
  async estimateCost(request: IRChatRequest): Promise<number | null> {
    const pricing: Record<string, { input: number; output: number }> = {
      'meta-llama/Meta-Llama-3.1-8B-Instruct': { input: 0.40, output: 0.40 },
      'meta-llama/Meta-Llama-3.1-70B-Instruct': { input: 0.60, output: 0.60 },
      'Qwen/Qwen2.5-72B-Instruct': { input: 0.60, output: 0.60 },
      'deepseek-ai/DeepSeek-V3': { input: 0.60, output: 2.00 },
      'mistralai/Mixtral-8x7B-Instruct-v0.1': { input: 0.24, output: 0.24 },
    };

    const model = request.parameters?.model || this.config.defaultModel || '';
    const modelPricing = pricing[model];

    if (!modelPricing) {
      return null;
    }

    const inputTokens = request.messages.reduce((sum, msg) => {
      const content = typeof msg.content === 'string' ? msg.content : '';
      return sum + Math.ceil(content.length / 4);
    }, 0);

    const outputTokens = request.parameters?.maxTokens || 1024;

    const inputCost = (inputTokens / 1_000_000) * modelPricing.input;
    const outputCost = (outputTokens / 1_000_000) * modelPricing.output;

    return inputCost + outputCost;
  }
}
