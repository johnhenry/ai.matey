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

/**
 * Gemini content structure for messages.
 *
 * Google Gemini uses a unique `parts` array format where each message contains
 * an array of content parts. Each part can be text or inline data (images).
 * Role is either 'user' or 'model' (Gemini calls the assistant 'model').
 *
 * @see GeminiRequest
 * @see https://ai.google.dev/api/rest/v1/Content
 *
 * @example
 * ```typescript
 * // Text-only message
 * const textContent: GeminiContent = {
 *   role: 'user',
 *   parts: [{ text: 'Hello, Gemini!' }]
 * };
 *
 * // Multimodal message with image
 * const multimodalContent: GeminiContent = {
 *   role: 'user',
 *   parts: [
 *     { text: 'What is in this image?' },
 *     {
 *       inlineData: {
 *         mimeType: 'image/jpeg',
 *         data: 'base64-encoded-image-data...'
 *       }
 *     }
 *   ]
 * };
 * ```
 */
export interface GeminiContent {
  /** Message role - 'user' or 'model' (Gemini's term for assistant) */
  role: 'user' | 'model';

  /** Array of content parts - can mix text and inline data (images) */
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
}

/**
 * Google Gemini API request structure.
 *
 * Defines parameters for making a request to Google's Gemini API. Key differences
 * from other providers: uses `contents` (plural) for messages, `systemInstruction`
 * for system prompts, and generation parameters in a nested `generationConfig` object.
 * Temperature range is 0-1 (not 0-2 like some other providers).
 *
 * @see GeminiContent
 * @see GeminiResponse
 * @see https://ai.google.dev/api/rest/v1/models/generateContent
 *
 * @example
 * ```typescript
 * const request: GeminiRequest = {
 *   contents: [
 *     {
 *       role: 'user',
 *       parts: [{ text: 'Explain quantum computing' }]
 *     }
 *   ],
 *   systemInstruction: {
 *     parts: [{ text: 'You are a helpful physics teacher.' }]
 *   },
 *   generationConfig: {
 *     temperature: 0.7,
 *     maxOutputTokens: 1024
 *   }
 * };
 * ```
 */
export interface GeminiRequest {
  /** Array of conversation contents (user and model messages) */
  contents: GeminiContent[];

  /** System instruction/prompt (separate from contents) */
  systemInstruction?: { parts: Array<{ text: string }> };

  /** Generation parameters nested in config object */
  generationConfig?: {
    /** Sampling temperature 0-1 (Gemini uses 0-1, not 0-2) */
    temperature?: number;

    /** Nucleus sampling parameter 0-1 */
    topP?: number;

    /** Top-K sampling parameter */
    topK?: number;

    /** Maximum tokens to generate */
    maxOutputTokens?: number;

    /** Stop sequences - generation stops when encountered */
    stopSequences?: string[];
  };
}

/**
 * Google Gemini API response structure.
 *
 * Contains the response from Gemini including generated content, finish reason,
 * and token usage. Gemini can return multiple candidates (alternative completions)
 * though typically only one is returned. Finish reasons include safety-related
 * stops unique to Gemini.
 *
 * @see GeminiRequest
 * @see GeminiContent
 * @see https://ai.google.dev/api/rest/v1/GenerateContentResponse
 *
 * @example
 * ```typescript
 * const response: GeminiResponse = {
 *   candidates: [
 *     {
 *       content: {
 *         role: 'model',
 *         parts: [{ text: 'Quantum computing uses quantum mechanics...' }]
 *       },
 *       finishReason: 'STOP'
 *     }
 *   ],
 *   usageMetadata: {
 *     promptTokenCount: 15,
 *     candidatesTokenCount: 120,
 *     totalTokenCount: 135
 *   }
 * };
 * ```
 */
export interface GeminiResponse {
  /** Array of candidate responses (usually just one) */
  candidates: Array<{
    /** Generated content from the model */
    content: GeminiContent;

    /** Reason generation stopped: 'STOP' (natural), 'MAX_TOKENS', 'SAFETY', 'RECITATION', 'OTHER' */
    finishReason: 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'RECITATION' | 'OTHER';
  }>;

  /** Token usage statistics */
  usageMetadata?: {
    /** Number of tokens in the prompt */
    promptTokenCount: number;

    /** Number of tokens in all candidates */
    candidatesTokenCount: number;

    /** Total tokens used (prompt + candidates) */
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

  /**
   * Convert Google Gemini API request to Universal IR format.
   *
   * This method transforms a Gemini-formatted request into the standardized
   * Intermediate Representation (IR) format. It handles Gemini's unique
   * content structure (parts array), converts 'model' role to 'assistant',
   * and adjusts temperature values (Gemini uses 0-1, IR uses 0-2).
   *
   * @param request - Google Gemini API request
   * @returns Promise resolving to IR chat request
   *
   * @example
   * ```typescript
   * const adapter = new GeminiFrontendAdapter();
   * const irRequest = await adapter.toIR({
   *   contents: [{ role: 'user', parts: [{ text: 'Hello!' }] }],
   *   generationConfig: { temperature: 0.7 }
   * });
   * ```
   */
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

  /**
   * Convert Universal IR response back to Google Gemini API format.
   *
   * This method transforms the standardized IR response into the format
   * expected by Gemini's API. It converts 'assistant' role back to 'model',
   * structures content as parts array, and maps finish reasons to Gemini's
   * specific format (STOP, MAX_TOKENS, OTHER).
   *
   * @param response - Universal IR chat response
   * @returns Promise resolving to Gemini API response
   *
   * @example
   * ```typescript
   * const adapter = new GeminiFrontendAdapter();
   * const geminiResponse = await adapter.fromIR(irResponse);
   * console.log(geminiResponse.candidates[0].content.parts[0].text);
   * ```
   */
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

  /**
   * Convert Universal IR stream to Google Gemini Server-Sent Events format.
   *
   * This async generator method transforms a stream of IR chunks into
   * Gemini-formatted SSE responses. It yields Server-Sent Event strings
   * with the "data: " prefix containing JSON candidates with parts array.
   *
   * @param stream - Universal IR chat stream
   * @param _options - Optional stream conversion options (currently unused)
   * @yields Server-Sent Event formatted strings
   *
   * @example
   * ```typescript
   * const adapter = new GeminiFrontendAdapter();
   * for await (const sseData of adapter.fromIRStream(irStream)) {
   *   console.log(sseData); // "data: {...}\n\n"
   * }
   * ```
   */
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
