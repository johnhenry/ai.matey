/**
 * Cohere Backend Adapter
 *
 * Adapts Universal IR to Cohere Chat API.
 * Cohere has a custom API format optimized for RAG use cases.
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
// Cohere API Types (Custom API)
// ============================================================================

export interface CohereChatMessage {
  role: 'USER' | 'CHATBOT';  // Note: uppercase roles
  message: string;
}

export interface CohereRequest {
  model?: string;  // Optional in Cohere
  message: string;  // Current user message
  chat_history?: CohereChatMessage[];  // Previous conversation
  preamble?: string;  // System message
  temperature?: number;
  max_tokens?: number;
  p?: number;  // top_p equivalent
  k?: number;  // top_k
  frequency_penalty?: number;
  presence_penalty?: number;
  stop_sequences?: string[];
  stream?: boolean;
  // Cohere-specific RAG parameters
  documents?: Array<{
    id?: string;
    data: Record<string, any>;
  }>;
  connectors?: Array<{
    id: string;
  }>;
}

export interface CohereResponse {
  generation_id: string;
  text: string;
  finish_reason: 'COMPLETE' | 'MAX_TOKENS' | 'ERROR' | 'ERROR_TOXIC';
  meta?: {
    api_version: {
      version: string;
    };
    billed_units?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
  citations?: Array<{
    start: number;
    end: number;
    text: string;
    document_ids: string[];
  }>;
}

export interface CohereStreamChunk {
  event_type: 'stream-start' | 'text-generation' | 'stream-end' | 'citation-generation';
  text?: string;
  finish_reason?: 'COMPLETE' | 'MAX_TOKENS' | 'ERROR' | 'ERROR_TOXIC';
  generation_id?: string;
  citations?: Array<{
    start: number;
    end: number;
    text: string;
    document_ids: string[];
  }>;
}

// ============================================================================
// Cohere Backend Adapter
// ============================================================================

/**
 * Backend adapter for Cohere Chat API.
 *
 * Features:
 * - Custom API optimized for RAG
 * - Document and connector support
 * - Citation generation
 * - Text-only (no vision support)
 * - No function calling
 * - Pricing from $0.15 per 1M tokens
 */
export class CohereBackendAdapter implements BackendAdapter<CohereRequest, CohereResponse> {
  readonly metadata: AdapterMetadata;
  private readonly config: BackendAdapterConfig;
  private readonly baseURL: string;
  private readonly modelCache: ReturnType<typeof getModelCache>;

  constructor(config: BackendAdapterConfig) {
    this.config = config;
    this.baseURL = config.baseURL || 'https://api.cohere.ai/v1';
    this.modelCache = getModelCache(config.modelsCacheScope || 'global');
    this.metadata = {
      name: 'cohere-backend',
      version: '1.0.0',
      provider: 'Cohere',
      capabilities: {
        streaming: true,
        multiModal: false,  // Text-only
        tools: false,       // No function calling
        maxContextTokens: 128000,
        systemMessageStrategy: 'separate-parameter',  // Uses preamble field
        supportsMultipleSystemMessages: false,  // Only one preamble
        supportsTemperature: true,
        supportsTopP: true,
        supportsTopK: true,
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
   * Convert IR to Cohere format.
   */
  public fromIR(request: IRChatRequest): CohereRequest {
    const { messages, systemMessage } = normalizeSystemMessages(
      request.messages,
      this.metadata.capabilities.systemMessageStrategy,
      this.metadata.capabilities.supportsMultipleSystemMessages
    );

    // Cohere requires the last message to be a user message
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      throw new AdapterConversionError({
        code: ErrorCode.ADAPTER_CONVERSION_ERROR,
        message: 'Cohere requires the last message to be from user',
        provenance: { backend: this.metadata.name },
      });
    }

    // Extract text content from last message
    const currentMessage = typeof lastMessage.content === 'string'
      ? lastMessage.content
      : lastMessage.content.map((block) => block.type === 'text' ? block.text : '').join('');

    // Convert chat history (all messages except the last)
    const chatHistory: CohereChatMessage[] = messages.slice(0, -1).map((msg) => ({
      role: msg.role === 'user' ? 'USER' : 'CHATBOT',
      message: typeof msg.content === 'string'
        ? msg.content
        : msg.content.map((block) => block.type === 'text' ? block.text : '').join(''),
    }));

    const cohereRequest: CohereRequest = {
      message: currentMessage,
      temperature: request.parameters?.temperature,
      max_tokens: request.parameters?.maxTokens,
      p: request.parameters?.topP,
      k: request.parameters?.topK,
      frequency_penalty: request.parameters?.frequencyPenalty,
      presence_penalty: request.parameters?.presencePenalty,
      stop_sequences: request.parameters?.stopSequences,
      stream: request.stream || false,
    };

    // Add model if specified
    if (request.parameters?.model || this.config.defaultModel) {
      cohereRequest.model = request.parameters?.model || this.config.defaultModel || 'command-r';
    }

    // Add chat history if present
    if (chatHistory.length > 0) {
      cohereRequest.chat_history = chatHistory;
    }

    // Add system message as preamble
    if (systemMessage) {
      cohereRequest.preamble = typeof systemMessage === 'string'
        ? systemMessage
        : systemMessage.map((block: any) => block.type === 'text' ? block.text : '').join('');
    }

    // Add Cohere-specific RAG parameters if provided
    if (request.parameters?.custom?.documents) {
      cohereRequest.documents = request.parameters.custom.documents as Array<{ id?: string; data: Record<string, any> }>;
    }
    if (request.parameters?.custom?.connectors) {
      cohereRequest.connectors = request.parameters.custom.connectors as Array<{ id: string }>;
    }

    return cohereRequest;
  }

  /**
   * Convert Cohere response to IR.
   */
  public toIR(response: CohereResponse, originalRequest: IRChatRequest, latencyMs: number): IRChatResponse {
    const message: IRMessage = {
      role: 'assistant',
      content: response.text,
    };

    const finishReasonMap: Record<string, FinishReason> = {
      'COMPLETE': 'stop',
      'MAX_TOKENS': 'length',
      'ERROR': 'stop',
      'ERROR_TOXIC': 'stop',
    };

    const irResponse: IRChatResponse = {
      message,
      finishReason: finishReasonMap[response.finish_reason] || 'stop',
      usage: response.meta?.billed_units ? {
        promptTokens: response.meta.billed_units.input_tokens,
        completionTokens: response.meta.billed_units.output_tokens,
        totalTokens: response.meta.billed_units.input_tokens + response.meta.billed_units.output_tokens,
      } : undefined,
      metadata: {
        ...originalRequest.metadata,
        providerResponseId: response.generation_id,
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

    // Include citations if present
    if (response.citations && response.citations.length > 0) {
      irResponse.metadata.custom = {
        ...irResponse.metadata.custom,
        citations: response.citations,
      };
    }

    return irResponse;
  }

  /**
   * Execute non-streaming request.
   */
  async execute(request: IRChatRequest, signal?: AbortSignal): Promise<IRChatResponse> {
    try {
      const cohereRequest = this.fromIR(request);
      cohereRequest.stream = false;

      const startTime = Date.now();
      const response = await fetch(`${this.baseURL}/chat`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(cohereRequest),
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

      const data = (await response.json()) as CohereResponse;
      return this.toIR(data, request, Date.now() - startTime);
    } catch (error) {
      if (error instanceof NetworkError || error instanceof ProviderError) {
        throw error;
      }

      throw new ProviderError({
        code: ErrorCode.PROVIDER_ERROR,
        message: `Cohere request failed: ${error instanceof Error ? error.message : String(error)}`,
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
      const cohereRequest = this.fromIR(request);
      cohereRequest.stream = true;

      const streamingConfig = mergeStreamingConfig(this.config.streaming);
      const effectiveMode = getEffectiveStreamMode(
        request.streamMode,
        undefined,
        streamingConfig
      );
      const includeBoth = streamingConfig.includeBoth || effectiveMode === 'accumulated';

      const response = await fetch(`${this.baseURL}/chat`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(cohereRequest),
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
      let citations: CohereResponse['citations'] | undefined;

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
            if (!line.trim()) continue;

            try {
              const chunk = JSON.parse(line) as CohereStreamChunk;

              // Handle different event types
              if (chunk.event_type === 'text-generation' && chunk.text) {
                contentBuffer += chunk.text;

                const contentChunk: IRStreamChunk = {
                  type: 'content',
                  sequence: sequence++,
                  delta: chunk.text,
                  role: 'assistant',
                };

                if (includeBoth) {
                  (contentChunk as any).accumulated = contentBuffer;
                }

                yield contentChunk;
              } else if (chunk.event_type === 'citation-generation' && chunk.citations) {
                citations = chunk.citations;
              } else if (chunk.event_type === 'stream-end') {
                const finishReasonMap: Record<string, FinishReason> = {
                  'COMPLETE': 'stop',
                  'MAX_TOKENS': 'length',
                  'ERROR': 'stop',
                  'ERROR_TOXIC': 'stop',
                };

                const doneChunk: IRStreamChunk = {
                  type: 'done',
                  sequence: sequence++,
                  finishReason: finishReasonMap[chunk.finish_reason || 'COMPLETE'] || 'stop',
                  message: { role: 'assistant', content: contentBuffer },
                };

                // Include citations if present
                if (citations && citations.length > 0) {
                  (doneChunk as any).citations = citations;
                }

                yield doneChunk;
              }
            } catch (parseError) {
              console.warn('Failed to parse Cohere stream chunk:', line, parseError);
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
   * Cohere uses Authorization: Bearer token.
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
      const response = await fetch(`${this.baseURL}/check-api-key`, {
        method: 'POST',
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
   */
  async estimateCost(request: IRChatRequest): Promise<number | null> {
    const pricing: Record<string, { input: number; output: number }> = {
      'command-r': { input: 0.15, output: 0.60 },
      'command-r-plus': { input: 3.00, output: 15.00 },
      'command': { input: 1.00, output: 2.00 },
      'command-light': { input: 0.30, output: 0.60 },
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
