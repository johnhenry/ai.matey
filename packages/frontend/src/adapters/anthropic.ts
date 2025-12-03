/**
 * Anthropic Frontend Adapter
 *
 * Adapts Anthropic Messages API format to Universal IR.
 * Handles Anthropic's separate system parameter and content block structure.
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
// Anthropic API Types
// ============================================================================

/**
 * Anthropic content block type supporting text, images, and tool usage.
 *
 * Claude uses a structured content block format where each piece of content
 * is represented as an object with a discriminated `type` field. This enables
 * multimodal messages mixing text, images, and tool interactions.
 *
 * @see AnthropicMessage
 * @see https://docs.anthropic.com/en/api/messages
 *
 * @example
 * ```typescript
 * // Text block
 * const text: AnthropicContentBlock = {
 *   type: 'text',
 *   text: 'Hello, Claude!'
 * };
 *
 * // Image from URL
 * const imageUrl: AnthropicContentBlock = {
 *   type: 'image',
 *   source: {
 *     type: 'url',
 *     url: 'https://example.com/photo.jpg'
 *   }
 * };
 *
 * // Base64 image
 * const imageB64: AnthropicContentBlock = {
 *   type: 'image',
 *   source: {
 *     type: 'base64',
 *     media_type: 'image/jpeg',
 *     data: '/9j/4AAQSkZJRg...'
 *   }
 * };
 *
 * // Tool use request
 * const toolUse: AnthropicContentBlock = {
 *   type: 'tool_use',
 *   id: 'toolu_123',
 *   name: 'get_weather',
 *   input: { location: 'San Francisco' }
 * };
 * ```
 */
export type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image';
      source: { type: 'url'; url: string } | { type: 'base64'; media_type: string; data: string };
    }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };

/**
 * Anthropic message structure in a conversation.
 *
 * Claude messages support only 'user' and 'assistant' roles. System messages
 * are handled separately via the `system` parameter at the request level.
 * Content can be a simple string or an array of structured blocks.
 *
 * @see AnthropicContentBlock
 * @see AnthropicRequest
 */
export interface AnthropicMessage {
  /** Message role - only 'user' or 'assistant' (system is separate) */
  role: 'user' | 'assistant';

  /** Message content - simple string or array of content blocks for multimodal */
  content: string | AnthropicContentBlock[];
}

/**
 * Anthropic Messages API request structure.
 *
 * Defines all parameters for making a request to Claude via Anthropic's Messages API.
 * Key differences from OpenAI: system message is a separate parameter (not in messages),
 * max_tokens is required, and supports top_k sampling parameter.
 *
 * @see AnthropicMessage
 * @see AnthropicResponse
 * @see https://docs.anthropic.com/en/api/messages
 *
 * @example
 * ```typescript
 * const request: AnthropicRequest = {
 *   model: 'claude-3-5-sonnet-20241022',
 *   max_tokens: 1024,
 *   messages: [
 *     { role: 'user', content: 'Hello, Claude!' }
 *   ],
 *   system: 'You are a helpful assistant.',
 *   temperature: 0.7
 * };
 * ```
 */
export interface AnthropicRequest {
  /** Model ID (e.g., 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229') */
  model: string;

  /** Array of conversation messages (user and assistant only) */
  messages: AnthropicMessage[];

  /** System prompt/instructions (separate from messages array) */
  system?: string;

  /** Maximum tokens to generate - REQUIRED by Anthropic API */
  max_tokens: number;

  /** Sampling temperature 0-1. Higher = more random. Default 1 */
  temperature?: number;

  /** Nucleus sampling parameter 0-1. Alternative to temperature */
  top_p?: number;

  /** Top-K sampling parameter. Only sample from top K tokens */
  top_k?: number;

  /** Stop sequences - generation stops when encountered */
  stop_sequences?: string[];

  /** Enable streaming responses via Server-Sent Events */
  stream?: boolean;

  /** Optional metadata for tracking and abuse prevention */
  metadata?: {
    /** User identifier for abuse monitoring */
    user_id?: string;
  };
}

/**
 * Anthropic Messages API response structure.
 *
 * Contains the complete response from Claude including the generated content,
 * stop reason, and token usage. Content is always returned as an array of
 * structured blocks, even for simple text responses.
 *
 * @see AnthropicRequest
 * @see AnthropicContentBlock
 * @see https://docs.anthropic.com/en/api/messages
 *
 * @example
 * ```typescript
 * const response: AnthropicResponse = {
 *   id: 'msg_123',
 *   type: 'message',
 *   role: 'assistant',
 *   content: [
 *     { type: 'text', text: 'Hello! How can I help you today?' }
 *   ],
 *   model: 'claude-3-5-sonnet-20241022',
 *   stop_reason: 'end_turn',
 *   usage: {
 *     input_tokens: 12,
 *     output_tokens: 8
 *   }
 * };
 * ```
 */
export interface AnthropicResponse {
  /** Unique identifier for this message */
  id: string;

  /** Object type - always 'message' for Messages API */
  type: 'message';

  /** Role of the responder - always 'assistant' */
  role: 'assistant';

  /** Array of content blocks (even for simple text responses) */
  content: AnthropicContentBlock[];

  /** Model that generated the response */
  model: string;

  /** Reason generation stopped: 'end_turn' (natural), 'max_tokens', 'stop_sequence', 'tool_use', or null */
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null;

  /** The actual stop sequence matched (if stop_reason is 'stop_sequence') */
  stop_sequence?: string | null;

  /** Token usage statistics */
  usage: {
    /** Number of tokens in the input/prompt */
    input_tokens: number;

    /** Number of tokens in the output/completion */
    output_tokens: number;
  };
}

/**
 * Anthropic streaming event types via Server-Sent Events.
 *
 * Claude uses a more complex streaming protocol than OpenAI, with distinct
 * events for different stages: message start, content block start/delta/stop,
 * and message completion. This enables fine-grained control over streaming
 * display and supports tool use streaming.
 *
 * Event flow:
 * 1. `message_start` - Stream begins with metadata
 * 2. `content_block_start` - Each content block (text/tool) starts
 * 3. `content_block_delta` - Incremental content for the block
 * 4. `content_block_stop` - Block is complete
 * 5. `message_delta` - Final metadata (stop reason, usage)
 * 6. `message_stop` - Stream ends
 *
 * @see AnthropicRequest
 * @see AnthropicResponse
 * @see https://docs.anthropic.com/en/api/messages-streaming
 *
 * @example
 * ```typescript
 * // Message start event
 * const start: AnthropicStreamEvent = {
 *   type: 'message_start',
 *   message: { id: 'msg_123', model: 'claude-3-5-sonnet-20241022' }
 * };
 *
 * // Text delta event
 * const delta: AnthropicStreamEvent = {
 *   type: 'content_block_delta',
 *   index: 0,
 *   delta: { type: 'text_delta', text: 'Hello' }
 * };
 *
 * // Completion event
 * const done: AnthropicStreamEvent = {
 *   type: 'message_delta',
 *   delta: { stop_reason: 'end_turn' },
 *   usage: { output_tokens: 42 }
 * };
 * ```
 */
export type AnthropicStreamEvent =
  | { type: 'message_start'; message: Partial<AnthropicResponse> }
  | { type: 'content_block_start'; index: number; content_block: AnthropicContentBlock }
  | {
      type: 'content_block_delta';
      index: number;
      delta:
        | { type: 'text_delta'; text: string }
        | { type: 'input_json_delta'; partial_json: string };
    }
  | { type: 'content_block_stop'; index: number }
  | {
      type: 'message_delta';
      delta: { stop_reason: string; stop_sequence?: string | null };
      usage: { output_tokens: number };
    }
  | { type: 'message_stop' }
  | { type: 'error'; error: { type: string; message: string } };

// ============================================================================
// Anthropic Frontend Adapter
// ============================================================================

/**
 * Frontend adapter for Anthropic Messages API.
 */
export class AnthropicFrontendAdapter implements FrontendAdapter<
  AnthropicRequest,
  AnthropicResponse,
  AnthropicStreamEvent
> {
  readonly metadata: AdapterMetadata = {
    name: 'anthropic-frontend',
    version: '1.0.0',
    provider: 'Anthropic',
    capabilities: {
      streaming: true,
      multiModal: true,
      tools: true,
      maxContextTokens: 200000,
      systemMessageStrategy: 'separate-parameter',
      supportsMultipleSystemMessages: false, // Anthropic merges multiple system messages
      supportsTemperature: true,
      supportsTopP: true,
      supportsTopK: true,
    },
  };

  /**
   * Convert Anthropic Messages API request to Universal IR format.
   *
   * This method transforms an Anthropic-formatted request into the standardized
   * Intermediate Representation (IR) format. It handles Anthropic's unique system
   * message format (separate from messages array) by converting it to IR's
   * in-messages format, and maps Anthropic-specific parameters like top_k.
   *
   * @param request - Anthropic Messages API request
   * @returns Promise resolving to IR chat request
   * @throws {AdapterConversionError} If conversion fails
   *
   * @example
   * ```typescript
   * const adapter = new AnthropicFrontendAdapter();
   * const irRequest = await adapter.toIR({
   *   model: 'claude-3-5-sonnet-20241022',
   *   max_tokens: 1024,
   *   messages: [{ role: 'user', content: 'Hello!' }],
   *   system: 'You are a helpful assistant'
   * });
   * ```
   */
  toIR(request: AnthropicRequest): Promise<IRChatRequest> {
    try {
      // Convert messages
      const messages: IRMessage[] = request.messages.map((msg) => this.convertMessageToIR(msg));

      // Add system message if present
      if (request.system) {
        const systemMessage: IRMessage = {
          role: 'system',
          content: request.system,
        };
        messages.unshift(systemMessage);
      }

      // Build IR request
      const irRequest: IRChatRequest = {
        messages,
        parameters: {
          model: request.model,
          temperature: request.temperature,
          maxTokens: request.max_tokens,
          topP: request.top_p,
          topK: request.top_k,
          stopSequences: request.stop_sequences,
        },
        stream: request.stream ?? false,
        metadata: {
          requestId: crypto.randomUUID(),
          timestamp: Date.now(),
          provenance: {
            frontend: this.metadata.name,
          },
          custom: {
            anthropicMetadata: request.metadata,
          },
        },
      };

      return Promise.resolve(irRequest);
    } catch (error) {
      throw new AdapterConversionError({
        code: ErrorCode.ADAPTER_CONVERSION_ERROR,
        message: `Failed to convert Anthropic request to IR: ${error instanceof Error ? error.message : String(error)}`,
        provenance: {
          frontend: this.metadata.name,
        },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Convert Universal IR response back to Anthropic Messages API format.
   *
   * This method transforms the standardized IR response into the format
   * expected by Anthropic's Messages API. It handles message conversion,
   * stop reason mapping, and usage statistics formatting specific to
   * Anthropic's response structure.
   *
   * @param response - Universal IR chat response
   * @returns Promise resolving to Anthropic Messages API response
   * @throws {AdapterConversionError} If conversion fails
   *
   * @example
   * ```typescript
   * const adapter = new AnthropicFrontendAdapter();
   * const anthropicResponse = await adapter.fromIR(irResponse);
   * console.log(anthropicResponse.content[0].text);
   * ```
   */
  fromIR(response: IRChatResponse): Promise<AnthropicResponse> {
    try {
      // Convert message content
      const content = this.convertContentFromIR(response.message.content);

      // Map finish reason
      const stopReason = this.mapFinishReason(response.finishReason);

      // Build Anthropic response
      const anthropicResponse: AnthropicResponse = {
        id: response.metadata.requestId,
        type: 'message',
        role: 'assistant',
        content,
        model: response.metadata.provenance?.backend || 'unknown',
        stop_reason: stopReason,
        usage: {
          input_tokens: response.usage?.promptTokens ?? 0,
          output_tokens: response.usage?.completionTokens ?? 0,
        },
      };

      return Promise.resolve(anthropicResponse);
    } catch (error) {
      throw new AdapterConversionError({
        code: ErrorCode.ADAPTER_CONVERSION_ERROR,
        message: `Failed to convert IR response to Anthropic format: ${error instanceof Error ? error.message : String(error)}`,
        provenance: {
          frontend: this.metadata.name,
        },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Convert Universal IR stream to Anthropic Server-Sent Events (SSE) format.
   *
   * This async generator method transforms a stream of IR chunks into
   * Anthropic-formatted streaming events. It handles stream mode conversion,
   * tracks message metadata, and emits properly formatted SSE events
   * compatible with Anthropic's streaming API including message_start,
   * content_block_delta, and message_stop events.
   *
   * @param stream - Universal IR chat stream
   * @param options - Optional stream conversion options (stream mode, etc.)
   * @yields Anthropic-formatted streaming events
   * @throws {AdapterConversionError} If stream conversion fails
   *
   * @example
   * ```typescript
   * const adapter = new AnthropicFrontendAdapter();
   * for await (const event of adapter.fromIRStream(irStream)) {
   *   if (event.type === 'content_block_delta') {
   *     console.log(event.delta.text);
   *   }
   * }
   * ```
   */
  async *fromIRStream(
    stream: IRChatStream,
    options?: StreamConversionOptions
  ): AsyncGenerator<AnthropicStreamEvent, void, undefined> {
    try {
      // Apply stream mode conversion if options provided
      const processedStream = options ? convertStreamMode(stream, options) : stream;

      for await (const chunk of processedStream) {
        switch (chunk.type) {
          case 'start':
            // Emit message_start event
            yield {
              type: 'message_start',
              message: {
                id: chunk.metadata.requestId,
                type: 'message',
                role: 'assistant',
                model: chunk.metadata.provenance?.backend || 'unknown',
              },
            };
            // Emit content_block_start
            yield {
              type: 'content_block_start',
              index: 0,
              content_block: { type: 'text', text: '' },
            };
            break;

          case 'content':
            // Emit content delta
            yield {
              type: 'content_block_delta',
              index: 0,
              delta: { type: 'text_delta', text: chunk.delta },
            };
            break;

          case 'done': {
            // Emit content_block_stop
            yield {
              type: 'content_block_stop',
              index: 0,
            };
            // Emit message_delta with stop reason
            const stopReason = this.mapFinishReason(chunk.finishReason);
            yield {
              type: 'message_delta',
              delta: {
                stop_reason: stopReason || 'end_turn',
              },
              usage: {
                output_tokens: chunk.usage?.completionTokens ?? 0,
              },
            };
            // Emit message_stop
            yield {
              type: 'message_stop',
            };
            break;
          }

          case 'error':
            // Emit error event
            yield {
              type: 'error',
              error: {
                type: chunk.error.code,
                message: chunk.error.message,
              },
            };
            break;
        }
      }
    } catch (error) {
      // Emit error event
      yield {
        type: 'error',
        error: {
          type: 'stream_error',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Convert Anthropic message to IR message.
   */
  private convertMessageToIR(message: AnthropicMessage): IRMessage {
    // Convert content
    let content: string | MessageContent[];

    if (typeof message.content === 'string') {
      content = message.content;
    } else {
      content = message.content.map((block) => this.convertContentBlockToIR(block));
    }

    return {
      role: message.role,
      content,
    };
  }

  /**
   * Convert Anthropic content block to IR content block.
   */
  private convertContentBlockToIR(block: AnthropicContentBlock): MessageContent {
    switch (block.type) {
      case 'text':
        return {
          type: 'text',
          text: block.text,
        };

      case 'image':
        if (block.source.type === 'url') {
          return {
            type: 'image',
            source: {
              type: 'url',
              url: block.source.url,
            },
          };
        } else {
          return {
            type: 'image',
            source: {
              type: 'base64',
              mediaType: block.source.media_type,
              data: block.source.data,
            },
          };
        }

      case 'tool_use':
        return {
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input,
        };

      default:
        // Unknown block type, convert to text
        return {
          type: 'text',
          text: JSON.stringify(block),
        };
    }
  }

  /**
   * Convert IR content to Anthropic content blocks.
   */
  private convertContentFromIR(
    content: string | readonly MessageContent[]
  ): AnthropicContentBlock[] {
    if (typeof content === 'string') {
      return [{ type: 'text', text: content }];
    }

    return content.map((block): AnthropicContentBlock => {
      switch (block.type) {
        case 'text':
          return { type: 'text', text: block.text };

        case 'image':
          if (block.source.type === 'url') {
            return {
              type: 'image',
              source: { type: 'url', url: block.source.url },
            };
          } else {
            return {
              type: 'image',
              source: {
                type: 'base64',
                media_type: block.source.mediaType,
                data: block.source.data,
              },
            };
          }

        case 'tool_use':
          return {
            type: 'tool_use',
            id: block.id,
            name: block.name,
            input: block.input,
          };

        default:
          // Fallback to text
          return { type: 'text', text: JSON.stringify(block) };
      }
    });
  }

  /**
   * Map IR finish reason to Anthropic stop reason.
   */
  private mapFinishReason(
    finishReason: string
  ): 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null {
    switch (finishReason) {
      case 'stop':
        return 'end_turn';
      case 'length':
        return 'max_tokens';
      case 'tool_calls':
        return 'tool_use';
      default:
        return null;
    }
  }
}
