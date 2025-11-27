/**
 * Chrome AI Frontend Adapter
 *
 * Pass-through adapter for Chrome AI format.
 *
 * @module
 */

import type { FrontendAdapter, AdapterMetadata } from 'ai.matey.types';
import type { IRChatRequest, IRChatResponse, IRStreamChunk } from 'ai.matey.types';
import type { StreamConversionOptions } from 'ai.matey.types';
import { convertStreamMode } from 'ai.matey.utils';

export interface ChromeAIRequest {
  prompt: string;
  temperature?: number;
  topK?: number;
}

export interface ChromeAIResponse {
  text: string;
}

export class ChromeAIFrontendAdapter implements FrontendAdapter<ChromeAIRequest, ChromeAIResponse> {
  readonly metadata: AdapterMetadata = {
    name: 'chrome-ai-frontend',
    version: '1.0.0',
    provider: 'Chrome AI',
    capabilities: {
      streaming: true,
      multiModal: false,
      tools: false,
      systemMessageStrategy: 'prepend-user',
      supportsMultipleSystemMessages: false,
    },
  };

  toIR(request: ChromeAIRequest): Promise<IRChatRequest> {
    return Promise.resolve({
      messages: [{ role: 'user', content: request.prompt }],
      parameters: {
        temperature: request.temperature,
        topK: request.topK,
      },
      metadata: {
        requestId: `chrome-ai-${Date.now()}`,
        timestamp: Date.now(),
        provenance: { frontend: this.metadata.name },
      },
    });
  }

  fromIR(response: IRChatResponse): Promise<ChromeAIResponse> {
    return Promise.resolve({
      text: typeof response.message.content === 'string' ? response.message.content : '',
    });
  }

  async *fromIRStream(
    stream: AsyncGenerator<IRStreamChunk>,
    options?: StreamConversionOptions
  ): AsyncGenerator<string> {
    // Apply stream mode conversion if options provided
    const processedStream = options ? convertStreamMode(stream, options) : stream;

    for await (const chunk of processedStream) {
      if (chunk.type === 'content') {
        yield chunk.delta;
      }
    }
  }
}
