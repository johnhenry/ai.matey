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
export interface MistralMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface MistralRequest {
  model: string;
  messages: MistralMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  safe_mode?: boolean;
  random_seed?: number;
}

export interface MistralResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: MistralMessage;
    finish_reason: 'stop' | 'length' | 'model_length' | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
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
