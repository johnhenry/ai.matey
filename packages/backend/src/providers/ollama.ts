/**
 * Ollama Backend Adapter
 *
 * Adapts Universal IR to Ollama API.
 * Ollama uses a local server with OpenAI-compatible chat format.
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
} from 'ai.matey.types';
import {
  NetworkError,
  ProviderError,
  StreamError,
  ErrorCode,
  createErrorFromHttpResponse,
} from 'ai.matey.errors';
import { normalizeSystemMessages } from 'ai.matey.utils';
import { getEffectiveStreamMode, mergeStreamingConfig } from 'ai.matey.utils';

// ============================================================================
// Ollama API Types
// ============================================================================

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaRequest {
  model: string;
  messages: OllamaMessage[];
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    stop?: string[];
  };
  stream?: boolean;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  message: OllamaMessage;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

// ============================================================================
// Ollama Backend Adapter
// ============================================================================

export class OllamaBackendAdapter implements BackendAdapter<OllamaRequest, OllamaResponse> {
  readonly metadata: AdapterMetadata;
  private readonly config: BackendAdapterConfig;
  private readonly baseURL: string;

  constructor(config: BackendAdapterConfig) {
    this.config = config;
    this.baseURL = config.baseURL || 'http://localhost:11434';
    this.metadata = {
      name: 'ollama-backend',
      version: '1.0.0',
      provider: 'Ollama',
      capabilities: {
        streaming: true,
        multiModal: false,
        tools: false,
        maxContextTokens: 4096, // Varies by model
        systemMessageStrategy: 'in-messages',
        supportsMultipleSystemMessages: false,
        supportsTemperature: true,
        supportsTopP: true,
        supportsTopK: true,
        supportsSeed: false,
        supportsFrequencyPenalty: false,
        supportsPresencePenalty: false,
        maxStopSequences: 4,
      },
      config: { baseURL: this.baseURL },
    };
  }

  async execute(request: IRChatRequest, signal?: AbortSignal): Promise<IRChatResponse> {
    try {
      const ollamaRequest = this.fromIR(request);
      ollamaRequest.stream = false; // Explicitly disable streaming for non-streaming requests
      const startTime = Date.now();

      const response = await fetch(`${this.baseURL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.config.headers },
        body: JSON.stringify(ollamaRequest),
        signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw createErrorFromHttpResponse(response.status, response.statusText, errorBody, {
          backend: this.metadata.name,
        });
      }

      const data = (await response.json()) as OllamaResponse;
      return this.toIR(data, request, Date.now() - startTime);
    } catch (error) {
      if (error instanceof NetworkError || error instanceof ProviderError) {
        throw error;
      }
      throw new ProviderError({
        code: ErrorCode.PROVIDER_ERROR,
        message: `Ollama request failed: ${error instanceof Error ? error.message : String(error)}`,
        isRetryable: true,
        provenance: { backend: this.metadata.name },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async *executeStream(request: IRChatRequest, signal?: AbortSignal): IRChatStream {
    try {
      const ollamaRequest = this.fromIR(request);
      ollamaRequest.stream = true;

      // Get effective streaming configuration
      const streamingConfig = mergeStreamingConfig(this.config.streaming);
      const effectiveMode = getEffectiveStreamMode(request.streamMode, undefined, streamingConfig);
      const includeBoth = streamingConfig.includeBoth || effectiveMode === 'accumulated';

      const response = await fetch(`${this.baseURL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.config.headers },
        body: JSON.stringify(ollamaRequest),
        signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw createErrorFromHttpResponse(response.status, response.statusText, errorBody, {
          backend: this.metadata.name,
        });
      }

      if (!response.body) {
        throw new StreamError({
          code: ErrorCode.STREAM_ERROR,
          message: 'No response body',
          provenance: { backend: this.metadata.name },
        });
      }

      let sequence = 0;
      yield {
        type: 'start',
        sequence: sequence++,
        metadata: {
          ...request.metadata,
          provenance: { ...request.metadata.provenance, backend: this.metadata.name },
        },
      } as IRStreamChunk;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let contentBuffer = '';

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
            if (!line.trim()) {
              continue;
            }

            try {
              const chunk: OllamaResponse = JSON.parse(line);

              if (chunk.message?.content) {
                contentBuffer += chunk.message.content;

                // Build content chunk with optional accumulated field
                const contentChunk: IRStreamChunk = {
                  type: 'content',
                  sequence: sequence++,
                  delta: chunk.message.content,
                  role: 'assistant',
                };

                // Add accumulated field if configured
                if (includeBoth) {
                  (contentChunk as any).accumulated = contentBuffer;
                }

                yield contentChunk;
              }

              if (chunk.done) {
                const message: IRMessage = { role: 'assistant', content: contentBuffer };
                yield {
                  type: 'done',
                  sequence: sequence++,
                  finishReason: 'stop',
                  usage:
                    chunk.prompt_eval_count && chunk.eval_count
                      ? {
                          promptTokens: chunk.prompt_eval_count,
                          completionTokens: chunk.eval_count,
                          totalTokens: chunk.prompt_eval_count + chunk.eval_count,
                        }
                      : undefined,
                  message,
                } as IRStreamChunk;
              }
            } catch (parseError) {
              console.warn('Failed to parse Ollama JSONL chunk:', line, parseError);
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

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  estimateCost(_request: IRChatRequest): Promise<number | null> {
    return Promise.resolve(null); // Ollama is free (local)
  }

  /**
   * Convert IR request to Ollama format.
   *
   * Public method for testing and debugging - see what will be sent to Ollama.
   */
  public fromIR(request: IRChatRequest): OllamaRequest {
    const { messages } = normalizeSystemMessages(
      request.messages,
      this.metadata.capabilities.systemMessageStrategy,
      this.metadata.capabilities.supportsMultipleSystemMessages
    );

    const ollamaMessages: OllamaMessage[] = messages.map((msg) => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content:
        typeof msg.content === 'string'
          ? msg.content
          : msg.content.map((c) => (c.type === 'text' ? c.text : JSON.stringify(c))).join(''),
    }));

    return {
      model: request.parameters?.model || 'llama2',
      messages: ollamaMessages,
      options: {
        temperature: request.parameters?.temperature,
        top_p: request.parameters?.topP,
        top_k: request.parameters?.topK,
        num_predict: request.parameters?.maxTokens,
        stop: request.parameters?.stopSequences ? [...request.parameters.stopSequences] : undefined,
      },
      stream: request.stream,
    };
  }

  /**
   * Convert Ollama response to IR format.
   *
   * Public method for testing and debugging - parse Ollama responses manually.
   */
  public toIR(
    response: OllamaResponse,
    originalRequest: IRChatRequest,
    latencyMs: number
  ): IRChatResponse {
    const message: IRMessage = { role: 'assistant', content: response.message.content };

    return {
      message,
      finishReason: 'stop',
      usage:
        response.prompt_eval_count && response.eval_count
          ? {
              promptTokens: response.prompt_eval_count,
              completionTokens: response.eval_count,
              totalTokens: response.prompt_eval_count + response.eval_count,
            }
          : undefined,
      metadata: {
        ...originalRequest.metadata,
        providerResponseId: undefined, // Ollama does not provide a response ID
        provenance: { ...originalRequest.metadata.provenance, backend: this.metadata.name },
        custom: { ...originalRequest.metadata.custom, latencyMs },
      },
      raw: response as unknown as Record<string, unknown>,
    };
  }
}
