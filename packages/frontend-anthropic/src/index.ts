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
 * Anthropic message content block.
 */
export type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image';
      source: { type: 'url'; url: string } | { type: 'base64'; media_type: string; data: string };
    }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };

/**
 * Anthropic message.
 */
export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

/**
 * Anthropic Messages API request.
 */
export interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  system?: string;
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  stream?: boolean;
  metadata?: {
    user_id?: string;
  };
}

/**
 * Anthropic Messages API response.
 */
export interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null;
  stop_sequence?: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Anthropic SSE stream event.
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
export class AnthropicFrontendAdapter
  implements FrontendAdapter<AnthropicRequest, AnthropicResponse, AnthropicStreamEvent>
{
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
   * Convert Anthropic request to Universal IR.
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
   * Convert Universal IR response to Anthropic format.
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
   * Convert Universal IR stream to Anthropic SSE format.
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
