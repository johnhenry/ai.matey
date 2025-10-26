/**
 * Debug middleware - adds debug tracing to pipelines
 */

import type { IRChatRequest, IRChatResponse, IRStreamChunk } from '../types/ir.js';
import type { TraceStep } from './types.js';
import { debugLogger } from './logger.js';

/**
 * Debug middleware for chat requests
 */
export function createDebugMiddleware(middlewareName: string = 'debug') {
  return {
    name: middlewareName,

    async processRequest(request: IRChatRequest): Promise<IRChatRequest> {
      const requestId = request.metadata.requestId;

      // Start trace if not already started
      if (!debugLogger.getTrace(requestId)) {
        debugLogger.startTrace(requestId);
      }

      // Log request
      debugLogger.log('middleware_start', `${middlewareName}: Processing request`, 'debug', {
        requestId,
        model: request.parameters?.model,
        messageCount: request.messages.length,
      });

      const step: TraceStep = {
        name: middlewareName,
        type: 'middleware',
        startTime: Date.now(),
        input: {
          model: request.parameters?.model,
          messageCount: request.messages.length,
        },
      };

      debugLogger.addTraceStep(requestId, step);

      return request;
    },

    async processResponse(
      response: IRChatResponse,
      request: IRChatRequest
    ): Promise<IRChatResponse> {
      const requestId = request.metadata.requestId;
      const trace = debugLogger.getTrace(requestId);

      if (trace) {
        // Update last step with output
        const lastStep = trace.steps[trace.steps.length - 1];
        if (lastStep && lastStep.name === middlewareName) {
          const endTime = Date.now();
          const updatedStep: TraceStep = {
            ...lastStep,
            endTime,
            duration: endTime - lastStep.startTime,
            output: {
              finishReason: response.finishReason,
              usage: response.usage,
            },
          };

          // Replace last step
          const steps = [...trace.steps.slice(0, -1), updatedStep];
          const updatedTrace = { ...trace, steps };
          debugLogger['traces'].set(requestId, updatedTrace);
        }
      }

      debugLogger.log('middleware_end', `${middlewareName}: Response processed`, 'debug', {
        requestId,
        finishReason: response.finishReason,
        completionTokens: response.usage?.completionTokens,
      });

      return response;
    },

    async *processStream(
      stream: AsyncIterable<IRStreamChunk>,
      request: IRChatRequest
    ): AsyncIterable<IRStreamChunk> {
      const requestId = request.metadata.requestId;
      let chunkCount = 0;

      debugLogger.log('middleware_start', `${middlewareName}: Processing stream`, 'debug', {
        requestId,
      });

      for await (const chunk of stream) {
        chunkCount++;

        debugLogger.log(
          'adapter_stream_chunk',
          `${middlewareName}: Stream chunk ${chunkCount}`,
          'trace',
          {
            requestId,
            chunkType: chunk.type,
            chunkCount,
          }
        );

        yield chunk;
      }

      debugLogger.log('middleware_end', `${middlewareName}: Stream completed`, 'debug', {
        requestId,
        totalChunks: chunkCount,
      });
    },
  };
}

/**
 * Adapter debug wrapper - wraps backend adapter calls
 */
export function createAdapterDebugWrapper(
  adapter: {
    name?: string;
    chat: (request: IRChatRequest) => Promise<IRChatResponse>;
    chatStream?: (request: IRChatRequest) => AsyncIterable<IRStreamChunk>;
  }
) {
  const adapterName = adapter.name || 'unknown-adapter';

  return {
    ...adapter,

    async chat(request: IRChatRequest): Promise<IRChatResponse> {
      const requestId = request.metadata.requestId;
      const startTime = Date.now();

      debugLogger.log('adapter_call', `Calling adapter: ${adapterName}`, 'debug', {
        requestId,
        adapter: adapterName,
        model: request.parameters?.model,
      });

      try {
        const response = await adapter.chat(request);
        const endTime = Date.now();
        const duration = endTime - startTime;

        debugLogger.log('adapter_response', `Adapter response: ${adapterName}`, 'debug', {
          requestId,
          adapter: adapterName,
          duration,
          finishReason: response.finishReason,
          tokens: response.usage?.totalTokens,
        });

        // Add trace step
        const step: TraceStep = {
          name: adapterName,
          type: 'adapter',
          startTime,
          endTime,
          duration,
          input: { model: request.parameters?.model },
          output: {
            finishReason: response.finishReason,
            usage: response.usage,
          },
        };

        debugLogger.addTraceStep(requestId, step);

        return response;
      } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;

        debugLogger.error(`Adapter error: ${adapterName}`, error as Error, {
          requestId,
          adapter: adapterName,
          duration,
        });

        // Add error step
        const step: TraceStep = {
          name: adapterName,
          type: 'adapter',
          startTime,
          endTime,
          duration,
          error: error as Error,
        };

        debugLogger.addTraceStep(requestId, step);

        throw error;
      }
    },

    async *chatStream(request: IRChatRequest): AsyncIterable<IRStreamChunk> {
      if (!adapter.chatStream) {
        throw new Error(`Adapter ${adapterName} does not support streaming`);
      }

      const requestId = request.metadata.requestId;
      const startTime = Date.now();
      let chunkCount = 0;

      debugLogger.log('adapter_call', `Calling adapter stream: ${adapterName}`, 'debug', {
        requestId,
        adapter: adapterName,
      });

      try {
        for await (const chunk of adapter.chatStream(request)) {
          chunkCount++;

          debugLogger.log('adapter_stream_chunk', `Stream chunk from ${adapterName}`, 'trace', {
            requestId,
            adapter: adapterName,
            chunkType: chunk.type,
            chunkCount,
          });

          yield chunk;
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        debugLogger.log('adapter_response', `Adapter stream complete: ${adapterName}`, 'debug', {
          requestId,
          adapter: adapterName,
          duration,
          totalChunks: chunkCount,
        });

        // Add trace step
        const step: TraceStep = {
          name: adapterName,
          type: 'adapter',
          startTime,
          endTime,
          duration,
          metadata: { streamChunks: chunkCount },
        };

        debugLogger.addTraceStep(requestId, step);
      } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;

        debugLogger.error(`Adapter stream error: ${adapterName}`, error as Error, {
          requestId,
          adapter: adapterName,
          duration,
          chunksBeforeError: chunkCount,
        });

        // Add error step
        const step: TraceStep = {
          name: adapterName,
          type: 'adapter',
          startTime,
          endTime,
          duration,
          error: error as Error,
          metadata: { chunksBeforeError: chunkCount },
        };

        debugLogger.addTraceStep(requestId, step);

        throw error;
      }
    },
  };
}
