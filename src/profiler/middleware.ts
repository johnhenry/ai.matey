/**
 * Profiler middleware - adds performance measurements to requests
 */

import type { IRChatRequest, IRChatResponse, IRStreamChunk } from '../types/ir.js';
import { profiler } from './profiler.js';

/**
 * Create profiler middleware
 */
export function createProfilerMiddleware(name: string = 'profiler') {
  return {
    name,

    async processRequest(request: IRChatRequest): Promise<IRChatRequest> {
      const requestId = request.metadata.requestId;
      profiler.start(`${requestId}-total`, 'Total Request');
      profiler.start(`${requestId}-middleware-${name}`, `Middleware: ${name}`);

      return request;
    },

    async processResponse(
      response: IRChatResponse,
      request: IRChatRequest
    ): Promise<IRChatResponse> {
      const requestId = request.metadata.requestId;

      profiler.end(`${requestId}-middleware-${name}`, {
        finishReason: response.finishReason,
        tokens: response.usage?.totalTokens,
      });

      profiler.end(`${requestId}-total`, {
        finishReason: response.finishReason,
        usage: response.usage,
      });

      return response;
    },

    async *processStream(
      stream: AsyncIterable<IRStreamChunk>,
      request: IRChatRequest
    ): AsyncIterable<IRStreamChunk> {
      const requestId = request.metadata.requestId;
      let chunkCount = 0;

      for await (const chunk of stream) {
        chunkCount++;
        yield chunk;
      }

      profiler.end(`${requestId}-middleware-${name}`, {
        streamChunks: chunkCount,
      });

      profiler.end(`${requestId}-total`, {
        streamChunks: chunkCount,
      });
    },
  };
}
