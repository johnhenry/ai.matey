/**
 * Chrome AI Frontend Adapter
 *
 * Pass-through adapter for Chrome AI format.
 *
 * @module
 */

import type { FrontendAdapter, AdapterMetadata } from '../../types/adapters.js';
import type { IRChatRequest, IRChatResponse, IRStreamChunk } from '../../types/ir.js';
import type { StreamConversionOptions } from '../../types/streaming.js';
import { convertStreamMode } from '../../utils/streaming-modes.js';

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

  async toIR(request: ChromeAIRequest): Promise<IRChatRequest> {
    return {
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
    };
  }

  async fromIR(response: IRChatResponse): Promise<ChromeAIResponse> {
    return {
      text: typeof response.message.content === 'string' ? response.message.content : '',
    };
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
