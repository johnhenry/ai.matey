/**
 * Mistral Frontend Adapter
 *
 * Pass-through adapter for Mistral format.
 *
 * @module
 */

import type { FrontendAdapter, AdapterMetadata } from 'ai.matey.types';
import type { IRChatRequest, IRChatResponse, IRStreamChunk, IRMessage } from 'ai.matey.types';
import type { StreamConversionOptions } from 'ai.matey.types';

// Mistral API Types (defined locally to avoid cross-package type warnings)
/**
 * Mistral message structure.
 *
 * Mistral uses a straightforward message format similar to OpenAI with
 * system, user, and assistant roles. Content is always a simple string.
 *
 * @see MistralRequest
 */
export interface MistralMessage {
  /** Message role: system, user, or assistant */
  role: 'system' | 'user' | 'assistant';

  /** Message content as plain text */
  content: string;
}

/**
 * Mistral AI API request structure.
 *
 * Follows OpenAI-compatible format with some Mistral-specific features like
 * safe_mode and random_seed. Compatible with Mistral's chat completion endpoint.
 *
 * @see MistralMessage
 * @see MistralResponse
 * @see https://docs.mistral.ai/api/
 *
 * @example
 * ```typescript
 * const request: MistralRequest = {
 *   model: 'mistral-small',
 *   messages: [
 *     { role: 'user', content: 'Hello!' }
 *   ],
 *   temperature: 0.7,
 *   max_tokens: 150
 * };
 * ```
 */
export interface MistralRequest {
  /** Model ID (e.g., 'mistral-small', 'mistral-medium', 'mistral-large') */
  model: string;

  /** Array of conversation messages */
  messages: MistralMessage[];

  /** Sampling temperature 0-1. Higher = more random */
  temperature?: number;

  /** Maximum tokens to generate */
  max_tokens?: number;

  /** Nucleus sampling parameter 0-1 */
  top_p?: number;

  /** Enable streaming responses */
  stream?: boolean;

  /** Enable Mistral's content safety filter */
  safe_mode?: boolean;

  /** Deterministic sampling seed */
  random_seed?: number;
}

/**
 * Mistral AI API response structure.
 *
 * OpenAI-compatible response format with Mistral-specific finish reasons.
 * Includes generated message and token usage statistics.
 *
 * @see MistralRequest
 * @see MistralMessage
 *
 * @example
 * ```typescript
 * const response: MistralResponse = {
 *   id: 'cmpl-123',
 *   object: 'chat.completion',
 *   created: 1677652288,
 *   model: 'mistral-small',
 *   choices: [{
 *     index: 0,
 *     message: {
 *       role: 'assistant',
 *       content: 'Hello! How can I help?'
 *     },
 *     finish_reason: 'stop'
 *   }],
 *   usage: {
 *     prompt_tokens: 10,
 *     completion_tokens: 6,
 *     total_tokens: 16
 *   }
 * };
 * ```
 */
export interface MistralResponse {
  /** Unique completion identifier */
  id: string;

  /** Object type - always 'chat.completion' */
  object: 'chat.completion';

  /** Unix timestamp of creation */
  created: number;

  /** Model used for generation */
  model: string;

  /** Array of completion choices (usually one) */
  choices: Array<{
    /** Choice index */
    index: number;

    /** Generated message */
    message: MistralMessage;

    /** Stop reason: 'stop', 'length', 'model_length', or null */
    finish_reason: 'stop' | 'length' | 'model_length' | null;
  }>;

  /** Token usage statistics */
  usage: {
    /** Tokens in prompt */
    prompt_tokens: number;

    /** Tokens in completion */
    completion_tokens: number;

    /** Total tokens used */
    total_tokens: number;
  };
}

export class MistralFrontendAdapter implements FrontendAdapter<MistralRequest, MistralResponse> {
  readonly metadata: AdapterMetadata = {
    name: 'mistral-frontend',
    version: '1.0.0',
    provider: 'Mistral',
    capabilities: {
      streaming: true,
      multiModal: false,
      tools: true,
      systemMessageStrategy: 'in-messages',
      supportsMultipleSystemMessages: false,
    },
  };

  /**
   * Convert Mistral API request to Universal IR format.
   *
   * This method transforms a Mistral-formatted request into the standardized
   * Intermediate Representation (IR) format. Since Mistral's format is similar
   * to OpenAI and close to IR, this is largely a pass-through adapter with
   * field name mapping (e.g., random_seed → seed).
   *
   * @param request - Mistral API request
   * @returns Promise resolving to IR chat request
   *
   * @example
   * ```typescript
   * const adapter = new MistralFrontendAdapter();
   * const irRequest = await adapter.toIR({
   *   model: 'mistral-small',
   *   messages: [{ role: 'user', content: 'Hello!' }],
   *   temperature: 0.7
   * });
   * ```
   */
  toIR(request: MistralRequest): Promise<IRChatRequest> {
    const messages: IRMessage[] = request.messages.map((msg: MistralMessage) => ({
      role: msg.role,
      content: msg.content,
    }));

    return Promise.resolve({
      messages,
      parameters: {
        model: request.model,
        temperature: request.temperature,
        maxTokens: request.max_tokens,
        topP: request.top_p,
        seed: request.random_seed,
      },
      metadata: {
        requestId: `mistral-${Date.now()}`,
        timestamp: Date.now(),
        provenance: { frontend: this.metadata.name },
      },
      stream: request.stream,
    });
  }

  /**
   * Convert Universal IR response back to Mistral API format.
   *
   * This method transforms the standardized IR response into the format
   * expected by Mistral's API. It handles message conversion, finish reason
   * mapping (stop, length, model_length), and usage statistics formatting
   * specific to Mistral's response structure.
   *
   * @param response - Universal IR chat response
   * @returns Promise resolving to Mistral API response
   *
   * @example
   * ```typescript
   * const adapter = new MistralFrontendAdapter();
   * const mistralResponse = await adapter.fromIR(irResponse);
   * console.log(mistralResponse.choices[0].message.content);
   * ```
   */
  fromIR(response: IRChatResponse): Promise<MistralResponse> {
    return Promise.resolve({
      id: `mistral-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: (response.metadata.custom?.model as string) || 'mistral-small',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: typeof response.message.content === 'string' ? response.message.content : '',
          },
          finish_reason:
            response.finishReason === 'stop'
              ? 'stop'
              : response.finishReason === 'length'
                ? 'length'
                : null,
        },
      ],
      usage: response.usage
        ? {
            prompt_tokens: response.usage.promptTokens,
            completion_tokens: response.usage.completionTokens,
            total_tokens: response.usage.totalTokens,
          }
        : { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });
  }

  /**
   * Convert Universal IR stream to Mistral Server-Sent Events format.
   *
   * This async generator method transforms a stream of IR chunks into
   * Mistral-formatted SSE responses. It yields Server-Sent Event strings
   * with the "data: " prefix containing JSON with delta content, and
   * emits "data: [DONE]" when the stream completes.
   *
   * @param stream - Universal IR chat stream
   * @param _options - Optional stream conversion options (currently unused)
   * @yields Server-Sent Event formatted strings
   *
   * @example
   * ```typescript
   * const adapter = new MistralFrontendAdapter();
   * for await (const sseData of adapter.fromIRStream(irStream)) {
   *   console.log(sseData); // "data: {...}\n\n" or "data: [DONE]\n\n"
   * }
   * ```
   */
  async *fromIRStream(
    stream: AsyncGenerator<IRStreamChunk>,
    _options?: StreamConversionOptions
  ): AsyncGenerator<string> {
    for await (const chunk of stream) {
      if (chunk.type === 'content') {
        yield `data: ${JSON.stringify({ choices: [{ delta: { content: chunk.delta } }] })}\n\n`;
      } else if (chunk.type === 'done') {
        yield `data: [DONE]\n\n`;
      }
    }
  }
}
