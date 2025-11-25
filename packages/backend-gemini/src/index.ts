/**
 * Google Gemini Backend Adapter
 *
 * Adapts Universal IR to Google Gemini API.
 * Handles Gemini's systemInstruction field and content array format.
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
import {
  getEffectiveStreamMode,
  mergeStreamingConfig,
} from 'ai.matey.utils';

// ============================================================================
// Gemini API Types
// ============================================================================

export interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
}

export interface GeminiRequest {
  contents: GeminiContent[];
  systemInstruction?: { parts: Array<{ text: string }> };
  generationConfig?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    stopSequences?: string[];
  };
}

export interface GeminiResponse {
  candidates: Array<{
    content: GeminiContent;
    finishReason: 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'RECITATION' | 'OTHER';
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

// ============================================================================
// Gemini Backend Adapter
// ============================================================================

export class GeminiBackendAdapter implements BackendAdapter<GeminiRequest, GeminiResponse> {
  readonly metadata: AdapterMetadata;
  private readonly config: BackendAdapterConfig;
  private readonly baseURL: string;

  constructor(config: BackendAdapterConfig) {
    this.config = config;
    this.baseURL = config.baseURL || 'https://generativelanguage.googleapis.com/v1beta';

    // Note: Gemini is already browser-compatible by default (API key in URL query parameter)
    // The browserMode flag has no effect for this adapter

    this.metadata = {
      name: 'gemini-backend',
      version: '1.0.0',
      provider: 'Google Gemini',
      capabilities: {
        streaming: true,
        multiModal: true,
        tools: true,
        maxContextTokens: 2000000,
        systemMessageStrategy: 'separate-parameter',
        supportsMultipleSystemMessages: false,
        supportsTemperature: true,
        supportsTopP: true,
        supportsTopK: true,
        supportsSeed: false,
        supportsFrequencyPenalty: false,
        supportsPresencePenalty: false,
        maxStopSequences: 5,
      },
      config: { baseURL: this.baseURL },
    };
  }

  async execute(request: IRChatRequest, signal?: AbortSignal): Promise<IRChatResponse> {
    try {
      const geminiRequest = this.fromIR(request);
      const model = request.parameters?.model || 'gemini-pro';
      const endpoint = `${this.baseURL}/models/${model}:generateContent?key=${this.config.apiKey}`;

      const startTime = Date.now();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.config.headers },
        body: JSON.stringify(geminiRequest),
        signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw createErrorFromHttpResponse(response.status, response.statusText, errorBody, {
          backend: this.metadata.name,
        });
      }

      const data = (await response.json()) as GeminiResponse;
      return this.toIR(data, request, Date.now() - startTime);
    } catch (error) {
      if (error instanceof NetworkError || error instanceof ProviderError) throw error;
      throw new ProviderError({
        code: ErrorCode.PROVIDER_ERROR,
        message: `Gemini request failed: ${error instanceof Error ? error.message : String(error)}`,
        isRetryable: true,
        provenance: { backend: this.metadata.name },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async *executeStream(request: IRChatRequest, signal?: AbortSignal): IRChatStream {
    try {
      const geminiRequest = this.fromIR(request);
      const model = request.parameters?.model || 'gemini-pro';
      const endpoint = `${this.baseURL}/models/${model}:streamGenerateContent?key=${this.config.apiKey}`;

      // Get effective streaming configuration
      const streamingConfig = mergeStreamingConfig(this.config.streaming);
      const effectiveMode = getEffectiveStreamMode(
        request.streamMode,
        undefined,
        streamingConfig
      );
      const includeBoth = streamingConfig.includeBoth || effectiveMode === 'accumulated';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.config.headers },
        body: JSON.stringify(geminiRequest),
        signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw createErrorFromHttpResponse(response.status, response.statusText, errorBody, {
          backend: this.metadata.name,
        });
      }

      if (!response.body) throw new StreamError({ code: ErrorCode.STREAM_ERROR, message: 'No response body', provenance: { backend: this.metadata.name } });

      let sequence = 0;
      yield {
        type: 'start',
        sequence: sequence++,
        metadata: { ...request.metadata, provenance: { ...request.metadata.provenance, backend: this.metadata.name } },
      } as IRStreamChunk;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let contentBuffer = '';

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

            try {
              const chunk: GeminiResponse = JSON.parse(data);
              const candidate = chunk.candidates?.[0];
              if (!candidate) continue;

              const content = candidate.content?.parts?.[0];
              if (content && 'text' in content) {
                contentBuffer += content.text;

                // Build content chunk with optional accumulated field
                const contentChunk: IRStreamChunk = {
                  type: 'content',
                  sequence: sequence++,
                  delta: content.text,
                  role: 'assistant',
                };

                // Add accumulated field if configured
                if (includeBoth) {
                  (contentChunk as any).accumulated = contentBuffer;
                }

                yield contentChunk;
              }

              if (candidate.finishReason) {
                const message: IRMessage = { role: 'assistant', content: contentBuffer };
                yield {
                  type: 'done',
                  sequence: sequence++,
                  finishReason: this.mapFinishReason(candidate.finishReason),
                  usage: chunk.usageMetadata ? {
                    promptTokens: chunk.usageMetadata.promptTokenCount,
                    completionTokens: chunk.usageMetadata.candidatesTokenCount,
                    totalTokens: chunk.usageMetadata.totalTokenCount,
                  } : undefined,
                  message,
                } as IRStreamChunk;
              }
            } catch (parseError) {
              console.warn('Failed to parse Gemini SSE chunk:', data, parseError);
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
        error: { code: error instanceof Error ? error.name : 'UNKNOWN_ERROR', message: error instanceof Error ? error.message : String(error) },
      } as IRStreamChunk;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/models?key=${this.config.apiKey}`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async estimateCost(_request: IRChatRequest): Promise<number | null> {
    return null; // Cost estimation not implemented for Gemini
  }

  /**
   * Convert IR request to Gemini format.
   *
   * Public method for testing and debugging - see what will be sent to Gemini.
   */
  public fromIR(request: IRChatRequest): GeminiRequest {
    const { messages, systemParameter } = normalizeSystemMessages(
      request.messages,
      this.metadata.capabilities.systemMessageStrategy,
      this.metadata.capabilities.supportsMultipleSystemMessages
    );

    const contents: GeminiContent[] = messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: typeof msg.content === 'string' ? [{ text: msg.content }] : msg.content.map((c) => (c.type === 'text' ? { text: c.text } : { text: JSON.stringify(c) })),
    }));

    const systemInstruction = systemParameter ? { parts: [{ text: systemParameter }] } : undefined;

    return {
      contents,
      systemInstruction,
      generationConfig: {
        temperature: request.parameters?.temperature ? request.parameters.temperature / 2 : undefined,
        topP: request.parameters?.topP,
        topK: request.parameters?.topK,
        maxOutputTokens: request.parameters?.maxTokens,
        stopSequences: request.parameters?.stopSequences ? [...request.parameters.stopSequences] : undefined,
      },
    };
  }

  /**
   * Convert Gemini response to IR format.
   *
   * Public method for testing and debugging - parse Gemini responses manually.
   */
  public toIR(response: GeminiResponse, originalRequest: IRChatRequest, latencyMs: number): IRChatResponse {
    const candidate = response.candidates[0];
    if (!candidate) throw new AdapterConversionError({ code: ErrorCode.ADAPTER_CONVERSION_ERROR, message: 'No candidates in Gemini response', provenance: { backend: this.metadata.name } });

    const content = candidate.content.parts.map((p) => ('text' in p ? p.text : '')).join('');
    const message: IRMessage = { role: 'assistant', content };

    return {
      message,
      finishReason: this.mapFinishReason(candidate.finishReason),
      usage: response.usageMetadata ? {
        promptTokens: response.usageMetadata.promptTokenCount,
        completionTokens: response.usageMetadata.candidatesTokenCount,
        totalTokens: response.usageMetadata.totalTokenCount,
      } : undefined,
      metadata: {
        ...originalRequest.metadata,
        providerResponseId: undefined, // Gemini does not provide a response ID
        provenance: { ...originalRequest.metadata.provenance, backend: this.metadata.name },
        custom: { ...originalRequest.metadata.custom, latencyMs },
      },
      raw: response as unknown as Record<string, unknown>,
    };
  }

  private mapFinishReason(reason: string): FinishReason {
    switch (reason) {
      case 'STOP': return 'stop';
      case 'MAX_TOKENS': return 'length';
      case 'SAFETY': return 'content_filter';
      default: return 'stop';
    }
  }
}
