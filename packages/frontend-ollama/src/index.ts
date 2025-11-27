/**
 * Ollama Frontend Adapter
 *
 * Pass-through adapter for Ollama format.
 *
 * @module
 */

import type { FrontendAdapter, AdapterMetadata } from 'ai.matey.types';
import type { IRChatRequest, IRChatResponse, IRStreamChunk, IRMessage } from 'ai.matey.types';
import type { StreamConversionOptions } from 'ai.matey.types';
import type { OllamaRequest, OllamaResponse, OllamaMessage } from 'ai.matey.backend.ollama';

export class OllamaFrontendAdapter implements FrontendAdapter<OllamaRequest, OllamaResponse> {
  readonly metadata: AdapterMetadata = {
    name: 'ollama-frontend',
    version: '1.0.0',
    provider: 'Ollama',
    capabilities: {
      streaming: true,
      multiModal: false,
      tools: false,
      systemMessageStrategy: 'in-messages',
      supportsMultipleSystemMessages: false,
    },
  };

  toIR(request: OllamaRequest): Promise<IRChatRequest> {
    const messages: IRMessage[] = request.messages.map((msg: OllamaMessage) => ({
      role: msg.role,
      content: msg.content,
    }));

    return Promise.resolve({
      messages,
      parameters: {
        model: request.model,
        temperature: request.options?.temperature,
        topP: request.options?.top_p,
        topK: request.options?.top_k,
        maxTokens: request.options?.num_predict,
        stopSequences: request.options?.stop,
      },
      metadata: {
        requestId: `ollama-${Date.now()}`,
        timestamp: Date.now(),
        provenance: { frontend: this.metadata.name },
      },
      stream: request.stream,
    });
  }

  fromIR(response: IRChatResponse): Promise<OllamaResponse> {
    return Promise.resolve({
      model: (response.metadata.custom?.model as string) || 'unknown',
      created_at: new Date().toISOString(),
      message: {
        role: 'assistant',
        content: typeof response.message.content === 'string' ? response.message.content : '',
      },
      done: true,
      prompt_eval_count: response.usage?.promptTokens,
      eval_count: response.usage?.completionTokens,
    });
  }

  async *fromIRStream(
    stream: AsyncGenerator<IRStreamChunk>,
    _options?: StreamConversionOptions
  ): AsyncGenerator<string> {
    for await (const chunk of stream) {
      if (chunk.type === 'content') {
        yield JSON.stringify({ message: { content: chunk.delta }, done: false }) + '\n';
      } else if (chunk.type === 'done') {
        yield JSON.stringify({ message: { content: '' }, done: true }) + '\n';
      }
    }
  }
}
