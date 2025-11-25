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
import type { MistralRequest, MistralResponse, MistralMessage } from 'ai.matey.backend.mistral';

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

  async toIR(request: MistralRequest): Promise<IRChatRequest> {
    const messages: IRMessage[] = request.messages.map((msg: MistralMessage) => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }));

    return {
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
    };
  }

  async fromIR(response: IRChatResponse): Promise<MistralResponse> {
    return {
      id: `mistral-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: response.metadata.custom?.model as string || 'mistral-small',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: typeof response.message.content === 'string' ? response.message.content : '',
        },
        finish_reason: response.finishReason === 'stop' ? 'stop' : response.finishReason === 'length' ? 'length' : null,
      }],
      usage: response.usage ? {
        prompt_tokens: response.usage.promptTokens,
        completion_tokens: response.usage.completionTokens,
        total_tokens: response.usage.totalTokens,
      } : { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
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
