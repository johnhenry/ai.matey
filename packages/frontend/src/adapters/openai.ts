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
 * OpenAI message content.
 */
export type OpenAIMessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }
    >;

/**
 * OpenAI message.
 */
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: OpenAIMessageContent;
  name?: string;
  tool_call_id?: string;
}

/**
 * OpenAI Chat Completions API request.
 */
export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  user?: string;
  seed?: number;
}

/**
 * OpenAI Chat Completions API response.
 */
export interface OpenAIResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: OpenAIMessage;
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI streaming chunk.
 */
export interface OpenAIStreamChunk {
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
   * Convert OpenAI request to Universal IR.
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
   * Convert Universal IR response to OpenAI format.
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
   * Convert Universal IR stream to OpenAI SSE format.
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
