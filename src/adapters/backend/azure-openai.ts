/**
 * Azure OpenAI Backend Adapter
 *
 * Adapts Universal IR to Azure OpenAI Chat Completions API.
 * Azure OpenAI is OpenAI-compatible with enterprise features and deployment-based routing.
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
// Azure OpenAI API Types (OpenAI-compatible with Azure extensions)
// ============================================================================

export type AzureOpenAIMessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }
    >;

export interface AzureOpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: AzureOpenAIMessageContent;
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

export interface AzureOpenAIRequest {
  messages: AzureOpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  stream?: boolean;
  seed?: number;
  // Note: model is NOT sent in Azure OpenAI requests (deployment is in URL)
}

export interface AzureOpenAIResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: AzureOpenAIMessage;
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
    content_filter_results?: any;  // Azure content filtering
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AzureOpenAIStreamChunk {
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
    content_filter_results?: any;
  }>;
}

export interface AzureOpenAIConfig extends BackendAdapterConfig {
  resourceName?: string;      // Azure resource name
  deploymentId?: string;       // Azure deployment ID
  apiVersion?: string;         // Azure API version (default: '2024-02-15-preview')
}

// ============================================================================
// Azure OpenAI Backend Adapter
// ============================================================================

/**
 * Backend adapter for Azure OpenAI Chat Completions API.
 *
 * Features:
 * - OpenAI-compatible with deployment-based routing
 * - Enterprise features (SLA, private endpoints, VNet)
 * - Content filtering (configurable)
 * - Vision model support
 * - Function calling support
 * - Seed support for reproducibility
 * - Enterprise pricing with consumption-based billing
 */
export class AzureOpenAIBackendAdapter implements BackendAdapter<AzureOpenAIRequest, AzureOpenAIResponse> {
  readonly metadata: AdapterMetadata;
  private readonly config: AzureOpenAIConfig;
  private readonly resourceName: string;
  private readonly deploymentId: string;
  private readonly apiVersion: string;
  private readonly baseURL: string;
  private readonly modelCache: ReturnType<typeof getModelCache>;

  constructor(config: AzureOpenAIConfig) {
    this.config = config;

    // Extract Azure-specific config
    this.resourceName = config.resourceName || '';
    this.deploymentId = config.deploymentId || config.defaultModel || 'gpt-4o';
    this.apiVersion = config.apiVersion || '2024-02-15-preview';

    // Construct base URL from resource name or use provided baseURL
    if (config.baseURL) {
      this.baseURL = config.baseURL;
    } else if (this.resourceName) {
      this.baseURL = `https://${this.resourceName}.openai.azure.com`;
    } else {
      throw new AdapterConversionError({
        code: ErrorCode.ADAPTER_CONVERSION_ERROR,
        message: 'Azure OpenAI requires either baseURL or resourceName in config',
        provenance: { backend: 'azure-openai-backend' },
      });
    }

    this.modelCache = getModelCache(config.modelsCacheScope || 'global');

    this.metadata = {
      name: 'azure-openai-backend',
      version: '1.0.0',
      provider: 'Azure OpenAI',
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
        supportsSeed: true,
        supportsFrequencyPenalty: true,
        supportsPresencePenalty: true,
        maxStopSequences: 4,
      },
      config: {
        baseURL: this.baseURL,
        resourceName: this.resourceName,
        deploymentId: this.deploymentId,
        apiVersion: this.apiVersion,
      },
    };
  }

  /**
   * Get deployment ID from request or config.
   */
  private getDeploymentId(request: IRChatRequest): string {
    return request.parameters?.model || this.deploymentId;
  }

  /**
   * Build endpoint URL for a specific deployment.
   */
  private buildEndpointURL(deploymentId: string, endpoint: string): string {
    return `${this.baseURL}/openai/deployments/${deploymentId}${endpoint}?api-version=${this.apiVersion}`;
  }

  /**
   * Convert IR to Azure OpenAI format.
   */
  public fromIR(request: IRChatRequest): AzureOpenAIRequest {
    const { messages } = normalizeSystemMessages(
      request.messages,
      this.metadata.capabilities.systemMessageStrategy,
      this.metadata.capabilities.supportsMultipleSystemMessages
    );

    const azureMessages: AzureOpenAIMessage[] = messages.map((msg) => ({
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
                  url: block.source.url || `data:${block.source.mediaType};base64,${block.source.data}`,
                  detail: 'auto'
                }
              };
            }
            return { type: 'text', text: JSON.stringify(block) };
          }),
    }));

    const azureRequest: AzureOpenAIRequest = {
      messages: azureMessages,
      temperature: request.parameters?.temperature,
      max_tokens: request.parameters?.maxTokens,
      top_p: request.parameters?.topP,
      frequency_penalty: request.parameters?.frequencyPenalty,
      presence_penalty: request.parameters?.presencePenalty,
      stop: request.parameters?.stopSequences,
      stream: request.stream || false,
    };

    // Add seed if provided
    if (request.parameters?.seed !== undefined) {
      azureRequest.seed = request.parameters.seed;
    }

    return azureRequest;
  }

  /**
   * Convert Azure OpenAI response to IR.
   */
  public toIR(response: AzureOpenAIResponse, originalRequest: IRChatRequest, latencyMs: number): IRChatResponse {
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
      'content_filter': 'stop',  // Map content_filter to stop
    };

    const irResponse: IRChatResponse = {
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

    // Include Azure content filter results if present
    if (choice.content_filter_results) {
      irResponse.metadata.custom = {
        ...irResponse.metadata.custom,
        azure_content_filter: choice.content_filter_results,
      };
    }

    return irResponse;
  }

  /**
   * Execute non-streaming request.
   */
  async execute(request: IRChatRequest, signal?: AbortSignal): Promise<IRChatResponse> {
    try {
      const azureRequest = this.fromIR(request);
      azureRequest.stream = false;

      const deploymentId = this.getDeploymentId(request);
      const url = this.buildEndpointURL(deploymentId, '/chat/completions');

      const startTime = Date.now();
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(azureRequest),
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

      const data = (await response.json()) as AzureOpenAIResponse;
      return this.toIR(data, request, Date.now() - startTime);
    } catch (error) {
      if (error instanceof NetworkError || error instanceof ProviderError) {
        throw error;
      }

      throw new ProviderError({
        code: ErrorCode.PROVIDER_ERROR,
        message: `Azure OpenAI request failed: ${error instanceof Error ? error.message : String(error)}`,
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
      const azureRequest = this.fromIR(request);
      azureRequest.stream = true;

      const streamingConfig = mergeStreamingConfig(this.config.streaming);
      const effectiveMode = getEffectiveStreamMode(
        request.streamMode,
        undefined,
        streamingConfig
      );
      const includeBoth = streamingConfig.includeBoth || effectiveMode === 'accumulated';

      const deploymentId = this.getDeploymentId(request);
      const url = this.buildEndpointURL(deploymentId, '/chat/completions');

      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(azureRequest),
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
              const chunk = JSON.parse(data) as AzureOpenAIStreamChunk;
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

                const doneChunk: IRStreamChunk = {
                  type: 'done',
                  sequence: sequence++,
                  finishReason: finishReasonMap[chunk.choices[0].finish_reason] || 'stop',
                  message: { role: 'assistant', content: contentBuffer },
                };

                // Include content filter results if present
                if (chunk.choices[0].content_filter_results) {
                  (doneChunk as any).azure_content_filter = chunk.choices[0].content_filter_results;
                }

                yield doneChunk;
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
   * Azure uses api-key header instead of Authorization Bearer.
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'api-key': this.config.apiKey,  // Azure-specific header
    };

    return { ...headers, ...this.config.headers };
  }

  /**
   * Health check.
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Azure doesn't have a /models endpoint; we'll check a specific deployment
      const url = this.buildEndpointURL(this.deploymentId, '/chat/completions');

      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Estimate cost.
   * Azure pricing varies by region and deployment.
   * These are approximate US East costs.
   */
  async estimateCost(request: IRChatRequest): Promise<number | null> {
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 2.50, output: 10.00 },
      'gpt-4o-mini': { input: 0.15, output: 0.60 },
      'gpt-4': { input: 30.00, output: 60.00 },
      'gpt-4-turbo': { input: 10.00, output: 30.00 },
      'gpt-35-turbo': { input: 0.50, output: 1.50 },
    };

    const deploymentId = this.getDeploymentId(request);
    const modelPricing = pricing[deploymentId];

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
