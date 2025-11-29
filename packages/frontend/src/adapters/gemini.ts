/**
 * Gemini Frontend Adapter
 *
 * Adapts Google Gemini API format to Universal IR.
 * Handles Gemini's systemInstruction field and content array format.
 *
 * @module
 */

import type { FrontendAdapter, AdapterMetadata } from 'ai.matey.types';
import type { IRChatRequest, IRChatResponse, IRStreamChunk, IRMessage } from 'ai.matey.types';
import type { StreamConversionOptions } from 'ai.matey.types';

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

export class GeminiFrontendAdapter implements FrontendAdapter<GeminiRequest, GeminiResponse> {
  readonly metadata: AdapterMetadata = {
    name: 'gemini-frontend',
    version: '1.0.0',
    provider: 'Google Gemini',
    capabilities: {
      streaming: true,
      multiModal: true,
      tools: true,
      systemMessageStrategy: 'separate-parameter',
      supportsMultipleSystemMessages: false,
    },
  };

  toIR(request: GeminiRequest): Promise<IRChatRequest> {
    const messages: IRMessage[] = request.contents.map((c: GeminiContent) => ({
      role: c.role === 'model' ? 'assistant' : 'user',
      content: c.parts
        .map((p: { text: string } | { inlineData: { mimeType: string; data: string } }) =>
          'text' in p ? p.text : ''
        )
        .join(''),
    }));
    if (request.systemInstruction) {
      messages.unshift({
        role: 'system',
        content: request.systemInstruction.parts.map((p: { text: string }) => p.text).join(''),
      });
    }
    return Promise.resolve({
      messages,
      parameters: {
        temperature: request.generationConfig?.temperature
          ? request.generationConfig.temperature * 2
          : undefined,
        topP: request.generationConfig?.topP,
        topK: request.generationConfig?.topK,
        maxTokens: request.generationConfig?.maxOutputTokens,
        stopSequences: request.generationConfig?.stopSequences,
      },
      metadata: {
        requestId: 'gemini-' + Date.now(),
        timestamp: Date.now(),
        provenance: { frontend: this.metadata.name },
      },
    });
  }

  fromIR(response: IRChatResponse): Promise<GeminiResponse> {
    return Promise.resolve({
      candidates: [
        {
          content: {
            role: 'model',
            parts: [
              {
                text: typeof response.message.content === 'string' ? response.message.content : '',
              },
            ],
          },
          finishReason:
            response.finishReason === 'stop'
              ? 'STOP'
              : response.finishReason === 'length'
                ? 'MAX_TOKENS'
                : 'OTHER',
        },
      ],
      usageMetadata: response.usage
        ? {
            promptTokenCount: response.usage.promptTokens,
            candidatesTokenCount: response.usage.completionTokens,
            totalTokenCount: response.usage.totalTokens,
          }
        : undefined,
    });
  }

  async *fromIRStream(
    stream: AsyncGenerator<IRStreamChunk>,
    _options?: StreamConversionOptions
  ): AsyncGenerator<string> {
    for await (const chunk of stream) {
      if (chunk.type === 'content') {
        yield 'data: ' +
          JSON.stringify({ candidates: [{ content: { parts: [{ text: chunk.delta }] } }] }) +
          '\n\n';
      }
    }
  }
}
