/**
 * OpenRouter Backend Adapter
 *
 * Adapts Universal IR to OpenRouter Chat Completions API.
 * OpenRouter is OpenAI-compatible with unified access to 100+ models.
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
import {
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
// OpenRouter API Types (OpenAI-compatible with extensions)
// ============================================================================

export type OpenRouterMessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >;

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: OpenRouterMessageContent;
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

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  stream?: boolean;
  seed?: number;
  // OpenRouter-specific parameters
  transforms?: string[];           // Model-specific transformations
  route?: 'fallback';              // Fallback to alternative models
  provider?: {                     // Provider preferences
    order?: string[];              // Provider priority
    allow_fallbacks?: boolean;
  };
}

export interface OpenRouterResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: OpenRouterMessage;
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenRouterStreamChunk {
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
    finish_reason: 'stop' | 'length' | 'content_filter' | null;
  }>;
}

export interface OpenRouterConfig extends BackendAdapterConfig {
  siteUrl?: string;      // Your site URL (for HTTP-Referer header)
  siteName?: string;     // Your site name (for X-Title header)
}

// ============================================================================
// OpenRouter Backend Adapter
// ============================================================================

/**
 * Backend adapter for OpenRouter Chat Completions API.
 *
 * Features:
 * - Unified API for 100+ models from multiple providers
 * - OpenAI-compatible with extensions
 * - Automatic fallback routing
 * - Vision model support
 * - Function calling support
 * - Variable pricing depending on model
 */
export class OpenRouterBackendAdapter implements BackendAdapter<OpenRouterRequest, OpenRouterResponse> {
  readonly metadata: AdapterMetadata;
  private readonly config: OpenRouterConfig;
  private readonly baseURL: string;
  private readonly siteUrl: string;
  private readonly siteName: string;

  constructor(config: OpenRouterConfig) {
    this.config = config;
    this.baseURL = config.baseURL || 'https://openrouter.ai/api/v1';
    this.siteUrl = config.siteUrl || '';
    this.siteName = config.siteName || 'AI Matey';

    this.metadata = {
      name: 'openrouter-backend',
      version: '1.0.0',
      provider: 'OpenRouter',
      capabilities: {
        streaming: true,
        multiModal: true,  // Vision models available
        tools: true,       // Function calling
        maxContextTokens: 128000,
        systemMessageStrategy: 'in-messages',
        supportsMultipleSystemMessages: true,
        supportsTemperature: true,
        supportsTopP: true,
        supportsTopK: true,
        supportsSeed: true,
        supportsFrequencyPenalty: true,
        supportsPresencePenalty: true,
        maxStopSequences: 4,
      },
      config: {
        baseURL: this.baseURL,
        siteUrl: this.siteUrl,
        siteName: this.siteName,
      },
    };
  }

  /**
   * Convert IR to OpenRouter format.
   */
  public fromIR(request: IRChatRequest): OpenRouterRequest {
    const { messages } = normalizeSystemMessages(
      request.messages,
      this.metadata.capabilities.systemMessageStrategy,
      this.metadata.capabilities.supportsMultipleSystemMessages
    );

    const openrouterMessages: OpenRouterMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: typeof msg.content === 'string'
        ? msg.content
        : msg.content.map((block) => {
            if (block.type === 'text') {
              return { type: 'text', text: block.text };
            } else if (block.type === 'image') {
              return {
                type: 'image_url',
                image_url: {
                  url: block.source.type === 'url'
                    ? block.source.url
                    : `data:${block.source.mediaType};base64,${block.source.data}`
                }
              };
            }
            return { type: 'text', text: JSON.stringify(block) };
          }),
    }));

    const openrouterRequest: OpenRouterRequest = {
      model: request.parameters?.model || this.config.defaultModel || 'anthropic/claude-3-haiku',
      messages: openrouterMessages,
      temperature: request.parameters?.temperature,
      max_tokens: request.parameters?.maxTokens,
      top_p: request.parameters?.topP,
      top_k: request.parameters?.topK,
      frequency_penalty: request.parameters?.frequencyPenalty,
      presence_penalty: request.parameters?.presencePenalty,
      stop: request.parameters?.stopSequences ? [...request.parameters.stopSequences] : undefined,
      stream: request.stream || false,
    };

    // Add seed if provided
    if (request.parameters?.seed !== undefined) {
      openrouterRequest.seed = request.parameters.seed;
    }

    // Add OpenRouter-specific parameters if provided
    if (request.parameters?.custom?.route) {
      openrouterRequest.route = request.parameters.custom.route as 'fallback';
    }
    if (request.parameters?.custom?.provider) {
      openrouterRequest.provider = request.parameters.custom.provider as any;
    }
    if (request.parameters?.custom?.transforms) {
      openrouterRequest.transforms = request.parameters.custom.transforms as string[];
    }

    return openrouterRequest;
  }

  /**
   * Convert OpenRouter response to IR.
   */
  public toIR(response: OpenRouterResponse, originalRequest: IRChatRequest, latencyMs: number): IRChatResponse {
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
      content: typeof choice.message.content === 'string'
        ? choice.message.content
        : choice.message.content.map((c: any) => c.type === 'text' ? c.text : '').join(''),
    };

    const finishReasonMap: Record<string, FinishReason> = {
      'stop': 'stop',
      'length': 'length',
      'tool_calls': 'tool_calls',
      'content_filter': 'stop',
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
          actualModel: response.model,  // OpenRouter may route to different model
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
      const openrouterRequest = this.fromIR(request);
      openrouterRequest.stream = false;

      const startTime = Date.now();
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(openrouterRequest),
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

      const data = (await response.json()) as OpenRouterResponse;
      return this.toIR(data, request, Date.now() - startTime);
    } catch (error) {
      if (error instanceof NetworkError || error instanceof ProviderError) {
        throw error;
      }

      throw new ProviderError({
        code: ErrorCode.PROVIDER_ERROR,
        message: `OpenRouter request failed: ${error instanceof Error ? error.message : String(error)}`,
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
      const openrouterRequest = this.fromIR(request);
      openrouterRequest.stream = true;

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
        body: JSON.stringify(openrouterRequest),
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
              const chunk = JSON.parse(data) as OpenRouterStreamChunk;
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
                  'content_filter': 'stop',
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
   * OpenRouter requires HTTP-Referer and X-Title headers.
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
    };

    // Add OpenRouter-specific headers
    if (this.siteUrl) {
      headers['HTTP-Referer'] = this.siteUrl;
    }
    if (this.siteName) {
      headers['X-Title'] = this.siteName;
    }

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
   * OpenRouter pricing varies by model.
   */
  async estimateCost(request: IRChatRequest): Promise<number | null> {
    const pricing: Record<string, { input: number; output: number }> = {
      'anthropic/claude-3-haiku': { input: 0.25, output: 1.25 },
      'anthropic/claude-3-sonnet': { input: 3.00, output: 15.00 },
      'anthropic/claude-3-opus': { input: 15.00, output: 75.00 },
      'openai/gpt-4o': { input: 2.50, output: 10.00 },
      'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
      'meta-llama/llama-3.1-8b-instruct': { input: 0.05, output: 0.05 },
      'meta-llama/llama-3.1-70b-instruct': { input: 0.35, output: 0.40 },
      'google/gemini-pro-1.5': { input: 1.25, output: 5.00 },
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
