/**
 * OpenAI Frontend Adapter
 *
 * Adapts OpenAI Chat Completions API format to Universal IR.
 * Since OpenAI format is similar to IR, this is mostly a pass-through adapter.
 *
 * @module
 */

import type { FrontendAdapter, AdapterMetadata } from 'ai.matey.types';
import type {
  IRChatRequest,
  IRChatResponse,
  IRChatStream,
  IRMessage,
  MessageContent,
} from 'ai.matey.types';
import type { StreamConversionOptions } from 'ai.matey.types';
import { AdapterConversionError, ErrorCode } from 'ai.matey.errors';
import { convertStreamMode } from 'ai.matey.utils';

// ============================================================================
// OpenAI API Types
// ============================================================================

/**
 * OpenAI message content type supporting text and multimodal inputs.
 *
 * Can be either a simple string for text-only messages, or an array of content
 * blocks for multimodal messages that include images. The array form supports
 * mixing text and images in a single message.
 *
 * @see OpenAIMessage
 * @see https://platform.openai.com/docs/api-reference/chat/create#chat-create-messages
 *
 * @example
 * ```typescript
 * // Simple text
 * const textContent: OpenAIMessageContent = "Hello, world!";
 *
 * // Multimodal with image
 * const multimodalContent: OpenAIMessageContent = [
 *   { type: 'text', text: 'What is in this image?' },
 *   {
 *     type: 'image_url',
 *     image_url: {
 *       url: 'https://example.com/photo.jpg',
 *       detail: 'high'
 *     }
 *   }
 * ];
 * ```
 */
export type OpenAIMessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }
    >;

/**
 * OpenAI chat message structure.
 *
 * Represents a single message in a conversation with role-based content.
 * Supports text, multimodal content, and tool-related messages.
 *
 * @see OpenAIMessageContent
 * @see OpenAIRequest
 */
export interface OpenAIMessage {
  /** Message role: system (instructions), user (input), assistant (AI response), or tool (function results) */
  role: 'system' | 'user' | 'assistant' | 'tool';

  /** Message content - can be text string or array of content blocks for multimodal */
  content: OpenAIMessageContent;

  /** Optional name for the message author (useful for multi-user or tool messages) */
  name?: string;

  /** Tool call ID when role is 'tool' - links tool results to the original tool call */
  tool_call_id?: string;
}

/**
 * OpenAI Chat Completions API request structure.
 *
 * Defines all parameters for making a chat completion request to OpenAI's API.
 * This matches the official OpenAI API specification and is compatible with
 * OpenAI-compatible endpoints (Azure OpenAI, local models, etc.).
 *
 * @see OpenAIMessage
 * @see OpenAIResponse
 * @see https://platform.openai.com/docs/api-reference/chat/create
 *
 * @example
 * ```typescript
 * const request: OpenAIRequest = {
 *   model: 'gpt-4',
 *   messages: [
 *     { role: 'system', content: 'You are a helpful assistant.' },
 *     { role: 'user', content: 'Hello!' }
 *   ],
 *   temperature: 0.7,
 *   max_tokens: 150
 * };
 * ```
 */
export interface OpenAIRequest {
  /** Model ID (e.g., 'gpt-4', 'gpt-3.5-turbo') */
  model: string;

  /** Array of conversation messages */
  messages: OpenAIMessage[];

  /** Sampling temperature 0-2. Higher = more random. Default 1 */
  temperature?: number;

  /** Maximum tokens to generate in the response */
  max_tokens?: number;

  /** Nucleus sampling parameter 0-1. Alternative to temperature */
  top_p?: number;

  /** Penalty for token frequency -2 to 2. Reduces repetition */
  frequency_penalty?: number;

  /** Penalty for token presence -2 to 2. Encourages new topics */
  presence_penalty?: number;

  /** Stop sequence(s) - generation stops when encountered */
  stop?: string | string[];

  /** Enable streaming responses via Server-Sent Events */
  stream?: boolean;

  /** Unique user identifier for abuse monitoring */
  user?: string;

  /** Deterministic sampling seed for reproducible outputs */
  seed?: number;
}

/**
 * OpenAI Chat Completions API response structure.
 *
 * Contains the complete response from OpenAI's API including the generated
 * message, finish reason, and token usage statistics.
 *
 * @see OpenAIRequest
 * @see OpenAIMessage
 * @see https://platform.openai.com/docs/api-reference/chat/object
 *
 * @example
 * ```typescript
 * const response: OpenAIResponse = {
 *   id: 'chatcmpl-123',
 *   object: 'chat.completion',
 *   created: 1677652288,
 *   model: 'gpt-4',
 *   choices: [{
 *     index: 0,
 *     message: {
 *       role: 'assistant',
 *       content: 'Hello! How can I help you today?'
 *     },
 *     finish_reason: 'stop'
 *   }],
 *   usage: {
 *     prompt_tokens: 9,
 *     completion_tokens: 12,
 *     total_tokens: 21
 *   }
 * };
 * ```
 */
export interface OpenAIResponse {
  /** Unique identifier for this completion */
  id: string;

  /** Object type - always 'chat.completion' for non-streaming */
  object: 'chat.completion';

  /** Unix timestamp when the response was created */
  created: number;

  /** Model used for generating the response */
  model: string;

  /** Array of completion choices (usually just one) */
  choices: Array<{
    /** Choice index in the array */
    index: number;

    /** Generated message from the assistant */
    message: OpenAIMessage;

    /** Reason why generation stopped: 'stop' (natural), 'length' (max tokens), 'tool_calls', 'content_filter', or null */
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  }>;

  /** Token usage statistics for billing and monitoring */
  usage?: {
    /** Number of tokens in the prompt */
    prompt_tokens: number;

    /** Number of tokens in the completion */
    completion_tokens: number;

    /** Total tokens used (prompt + completion) */
    total_tokens: number;
  };
}

/**
 * OpenAI streaming response chunk structure.
 *
 * Represents a single chunk in a Server-Sent Events (SSE) stream. Each chunk
 * contains incremental content (delta) that should be appended to build the
 * complete message. The stream ends when finish_reason is non-null.
 *
 * @see OpenAIRequest
 * @see OpenAIResponse
 * @see https://platform.openai.com/docs/api-reference/chat/streaming
 *
 * @example
 * ```typescript
 * // Content chunk during streaming
 * const chunk: OpenAIStreamChunk = {
 *   id: 'chatcmpl-123',
 *   object: 'chat.completion.chunk',
 *   created: 1677652288,
 *   model: 'gpt-4',
 *   choices: [{
 *     index: 0,
 *     delta: { content: 'Hello' },
 *     finish_reason: null
 *   }]
 * };
 *
 * // Final chunk signaling completion
 * const finalChunk: OpenAIStreamChunk = {
 *   ...chunk,
 *   choices: [{
 *     index: 0,
 *     delta: {},
 *     finish_reason: 'stop'
 *   }]
 * };
 * ```
 */
export interface OpenAIStreamChunk {
  /** Unique identifier for this stream */
  id: string;

  /** Object type - always 'chat.completion.chunk' for streaming */
  object: 'chat.completion.chunk';

  /** Unix timestamp when the chunk was created */
  created: number;

  /** Model generating the stream */
  model: string;

  /** Array of delta choices (usually just one) */
  choices: Array<{
    /** Choice index in the array */
    index: number;

    /** Incremental content delta - append to previous content */
    delta: {
      /** Role (only in first chunk, usually 'assistant') */
      role?: 'assistant';

      /** Incremental text content to append */
      content?: string;
    };

    /** Non-null when stream is complete. Indicates why generation stopped */
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  }>;
}

// ============================================================================
// OpenAI Frontend Adapter
// ============================================================================

/**
 * Frontend adapter for OpenAI Chat Completions API.
 */
export class OpenAIFrontendAdapter implements FrontendAdapter<
  OpenAIRequest,
  OpenAIResponse,
  OpenAIStreamChunk
> {
  readonly metadata: AdapterMetadata = {
    name: 'openai-frontend',
    version: '1.0.0',
    provider: 'OpenAI',
    capabilities: {
      streaming: true,
      multiModal: true,
      tools: true,
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
  };

  /**
   * Convert OpenAI Chat Completions API request to Universal IR format.
   *
   * This method transforms an OpenAI-formatted request into the standardized
   * Intermediate Representation (IR) format used across all AI Matey adapters.
   * Since OpenAI's format is similar to IR, this is largely a pass-through
   * with field name mapping.
   *
   * @param request - OpenAI Chat Completions API request
   * @returns Promise resolving to IR chat request
   * @throws {AdapterConversionError} If conversion fails
   *
   * @example
   * ```typescript
   * const adapter = new OpenAIFrontendAdapter();
   * const irRequest = await adapter.toIR({
   *   model: 'gpt-4',
   *   messages: [{ role: 'user', content: 'Hello!' }],
   *   temperature: 0.7
   * });
   * ```
   */
  toIR(request: OpenAIRequest): Promise<IRChatRequest> {
    try {
      // Convert messages
      const messages: IRMessage[] = request.messages.map((msg) => this.convertMessageToIR(msg));

      // Build IR request
      const irRequest: IRChatRequest = {
        messages,
        parameters: {
          model: request.model,
          temperature: request.temperature,
          maxTokens: request.max_tokens,
          topP: request.top_p,
          frequencyPenalty: request.frequency_penalty,
          presencePenalty: request.presence_penalty,
          stopSequences: typeof request.stop === 'string' ? [request.stop] : request.stop,
          seed: request.seed,
          user: request.user,
        },
        stream: request.stream ?? false,
        metadata: {
          requestId: crypto.randomUUID(),
          timestamp: Date.now(),
          provenance: {
            frontend: this.metadata.name,
          },
        },
      };

      return Promise.resolve(irRequest);
    } catch (error) {
      throw new AdapterConversionError({
        code: ErrorCode.ADAPTER_CONVERSION_ERROR,
        message: `Failed to convert OpenAI request to IR: ${error instanceof Error ? error.message : String(error)}`,
        provenance: {
          frontend: this.metadata.name,
        },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Convert Universal IR response back to OpenAI Chat Completions API format.
   *
   * This method transforms the standardized IR response into the format
   * expected by OpenAI's Chat Completions API. It handles message conversion,
   * finish reason mapping, and usage statistics formatting.
   *
   * @param response - Universal IR chat response
   * @returns Promise resolving to OpenAI Chat Completions response
   * @throws {AdapterConversionError} If conversion fails
   *
   * @example
   * ```typescript
   * const adapter = new OpenAIFrontendAdapter();
   * const openaiResponse = await adapter.fromIR(irResponse);
   * console.log(openaiResponse.choices[0].message.content);
   * ```
   */
  fromIR(response: IRChatResponse): Promise<OpenAIResponse> {
    try {
      // Convert message
      const message = this.convertMessageFromIR(response.message);

      // Map finish reason
      const finishReason = this.mapFinishReason(response.finishReason);

      // Build OpenAI response
      const openaiResponse: OpenAIResponse = {
        id: response.metadata.requestId,
        object: 'chat.completion',
        created: Math.floor(response.metadata.timestamp / 1000),
        model: response.metadata.provenance?.backend || 'unknown',
        choices: [
          {
            index: 0,
            message,
            finish_reason: finishReason,
          },
        ],
        usage: response.usage
          ? {
              prompt_tokens: response.usage.promptTokens,
              completion_tokens: response.usage.completionTokens,
              total_tokens: response.usage.totalTokens,
            }
          : undefined,
      };

      return Promise.resolve(openaiResponse);
    } catch (error) {
      throw new AdapterConversionError({
        code: ErrorCode.ADAPTER_CONVERSION_ERROR,
        message: `Failed to convert IR response to OpenAI format: ${error instanceof Error ? error.message : String(error)}`,
        provenance: {
          frontend: this.metadata.name,
        },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Convert Universal IR stream to OpenAI Server-Sent Events (SSE) format.
   *
   * This async generator method transforms a stream of IR chunks into
   * OpenAI-formatted streaming chunks. It handles stream mode conversion
   * (delta/full/text), tracks message metadata, and emits properly
   * formatted SSE events compatible with OpenAI's streaming API.
   *
   * @param stream - Universal IR chat stream
   * @param options - Optional stream conversion options (stream mode, etc.)
   * @yields OpenAI-formatted streaming chunks
   * @throws {AdapterConversionError} If stream conversion fails
   *
   * @example
   * ```typescript
   * const adapter = new OpenAIFrontendAdapter();
   * for await (const chunk of adapter.fromIRStream(irStream)) {
   *   console.log(chunk.choices[0].delta.content);
   * }
   * ```
   */
  async *fromIRStream(
    stream: IRChatStream,
    options?: StreamConversionOptions
  ): AsyncGenerator<OpenAIStreamChunk, void, undefined> {
    try {
      // Apply stream mode conversion if options provided
      const processedStream = options ? convertStreamMode(stream, options) : stream;

      let messageId = '';
      let model = '';
      let created = 0;

      for await (const chunk of processedStream) {
        switch (chunk.type) {
          case 'start':
            // Extract metadata
            messageId = chunk.metadata.requestId;
            model = chunk.metadata.provenance?.backend || 'unknown';
            created = Math.floor(chunk.metadata.timestamp / 1000);
            break;

          case 'content':
            // Emit content delta
            yield {
              id: messageId,
              object: 'chat.completion.chunk',
              created,
              model,
              choices: [
                {
                  index: 0,
                  delta: {
                    content: chunk.delta,
                  },
                  finish_reason: null,
                },
              ],
            };
            break;

          case 'done': {
            // Emit finish chunk
            const finishReason = this.mapFinishReason(chunk.finishReason);
            yield {
              id: messageId,
              object: 'chat.completion.chunk',
              created,
              model,
              choices: [
                {
                  index: 0,
                  delta: {},
                  finish_reason: finishReason,
                },
              ],
            };
            break;
          }
          case 'error':
            // OpenAI doesn't have a standard error event in SSE
            // We'll just stop the stream
            break;
        }
      }
    } catch {
      // Silently end stream on error
      // OpenAI SSE format doesn't have a standard error event
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Convert OpenAI message to IR message.
   */
  private convertMessageToIR(message: OpenAIMessage): IRMessage {
    // Convert content
    let content: string | MessageContent[];

    if (typeof message.content === 'string') {
      content = message.content;
    } else {
      content = message.content.map((block) => {
        if (block.type === 'text') {
          return { type: 'text', text: block.text };
        } else {
          return {
            type: 'image',
            source: {
              type: 'url',
              url: block.image_url.url,
            },
          } as MessageContent;
        }
      });
    }

    return {
      role: message.role,
      content,
      name: message.name,
    };
  }

  /**
   * Convert IR message to OpenAI message.
   */
  private convertMessageFromIR(message: IRMessage): OpenAIMessage {
    // Convert content
    let content: OpenAIMessageContent;

    if (typeof message.content === 'string') {
      content = message.content;
    } else {
      content = message.content.map((block) => {
        switch (block.type) {
          case 'text':
            return { type: 'text', text: block.text };

          case 'image':
            if (block.source.type === 'url') {
              return {
                type: 'image_url',
                image_url: { url: block.source.url },
              };
            } else {
              // Convert base64 to data URL
              const dataUrl = `data:${block.source.mediaType};base64,${block.source.data}`;
              return {
                type: 'image_url',
                image_url: { url: dataUrl },
              };
            }

          default:
            // Fallback to text
            return { type: 'text', text: JSON.stringify(block) };
        }
      });
    }

    return {
      role: message.role as 'system' | 'user' | 'assistant' | 'tool',
      content,
      name: message.name,
    };
  }

  /**
   * Map IR finish reason to OpenAI finish reason.
   */
  private mapFinishReason(
    finishReason: string
  ): 'stop' | 'length' | 'tool_calls' | 'content_filter' | null {
    switch (finishReason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'tool_calls':
        return 'tool_calls';
      case 'content_filter':
        return 'content_filter';
      default:
        return null;
    }
  }
}
