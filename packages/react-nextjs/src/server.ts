/**
 * Next.js Server Utilities
 *
 * Server-side utilities for Next.js App Router and API Routes.
 *
 * @module
 */

import type { Bridge } from 'ai.matey.core';

/**
 * Streaming response options.
 */
export interface StreamingResponseOptions {
  /** Response headers */
  headers?: Record<string, string>;
  /** Response status code */
  status?: number;
}

/**
 * Create a streaming Response for Next.js App Router.
 *
 * @param stream - Async iterable of chunks
 * @param options - Response options
 * @returns Web Response with streaming body
 *
 * @example
 * ```typescript
 * // app/api/chat/route.ts
 * import { createStreamingResponse } from 'ai.matey.react.nextjs/server';
 * import { Bridge } from 'ai.matey.core';
 *
 * export async function POST(request: Request) {
 *   const { messages } = await request.json();
 *   const bridge = new Bridge({ backend, frontend });
 *
 *   const stream = bridge.chatStream({ messages });
 *   return createStreamingResponse(stream);
 * }
 * ```
 */
export function createStreamingResponse(
  stream: AsyncIterable<string> | ReadableStream<Uint8Array>,
  options: StreamingResponseOptions = {}
): Response {
  const { headers = {}, status = 200 } = options;

  let body: ReadableStream<Uint8Array>;

  if (stream instanceof ReadableStream) {
    body = stream;
  } else {
    // Convert async iterable to ReadableStream
    const encoder = new TextEncoder();
    body = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
  }

  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      ...headers,
    },
  });
}

/**
 * Create a Server-Sent Events (SSE) response.
 *
 * @param stream - Async iterable of data objects
 * @param options - Response options
 * @returns Web Response with SSE body
 *
 * @example
 * ```typescript
 * // app/api/chat/route.ts
 * import { createSSEResponse } from 'ai.matey.react.nextjs/server';
 *
 * export async function POST(request: Request) {
 *   const stream = generateChatStream();
 *   return createSSEResponse(stream);
 * }
 * ```
 */
export function createSSEResponse<T>(
  stream: AsyncIterable<T>,
  options: StreamingResponseOptions = {}
): Response {
  const { headers = {}, status = 200 } = options;
  const encoder = new TextEncoder();

  const body = new ReadableStream({
    async start(controller) {
      try {
        for await (const data of stream) {
          const sseMessage = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(sseMessage));
        }

        // Send done signal
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      ...headers,
    },
  });
}

/**
 * Options for creating a chat handler.
 */
export interface CreateChatHandlerOptions {
  /** Bridge instance or factory */
  bridge: Bridge | (() => Bridge | Promise<Bridge>);
  /** Request validation */
  validate?: (body: unknown) => boolean;
  /** Transform request before processing */
  transformRequest?: (body: ChatRequestBody) => ChatRequestBody;
  /** Transform response chunks */
  transformChunk?: (chunk: string) => string;
  /** Error handler */
  onError?: (error: Error) => Response;
}

/**
 * Chat request body structure.
 */
export interface ChatRequestBody {
  /** Chat messages */
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  /** Model to use */
  model?: string;
  /** Temperature */
  temperature?: number;
  /** Max tokens */
  maxTokens?: number;
  /** Stream response */
  stream?: boolean;
  /** Additional options */
  [key: string]: unknown;
}

/**
 * Create a chat API route handler for Next.js.
 *
 * @param options - Handler options
 * @returns Route handler function
 *
 * @example
 * ```typescript
 * // app/api/chat/route.ts
 * import { createChatHandler } from 'ai.matey.react.nextjs/server';
 * import { Bridge } from 'ai.matey.core';
 * import { OpenAIBackend } from 'ai.matey.backend/openai';
 *
 * const bridge = new Bridge({
 *   backend: new OpenAIBackend({ apiKey: process.env.OPENAI_API_KEY }),
 * });
 *
 * export const POST = createChatHandler({ bridge });
 * ```
 */
export function createChatHandler(options: CreateChatHandlerOptions) {
  const { bridge: bridgeOrFactory, validate, transformRequest, transformChunk, onError } = options;

  return async function handler(request: Request): Promise<Response> {
    try {
      // Parse request body
      const body = (await request.json()) as ChatRequestBody;

      // Validate if provided
      if (validate && !validate(body)) {
        return new Response(JSON.stringify({ error: 'Invalid request body' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Get bridge instance
      const bridge =
        typeof bridgeOrFactory === 'function' ? await bridgeOrFactory() : bridgeOrFactory;

      // Transform request if provided
      const processedBody = transformRequest ? transformRequest(body) : body;

      // Check if streaming is requested
      const shouldStream = processedBody.stream !== false;

      if (shouldStream) {
        // Streaming response
        const stream = bridge.chatStream({
          messages: processedBody.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          model: processedBody.model,
          temperature: processedBody.temperature,
          maxTokens: processedBody.maxTokens,
        });

        // Transform chunks if needed
        const transformedStream = transformChunk
          ? transformStreamChunks(stream, transformChunk)
          : stream;

        return createSSEResponse(transformedStream);
      } else {
        // Non-streaming response
        const response = await bridge.chat({
          messages: processedBody.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          model: processedBody.model,
          temperature: processedBody.temperature,
          maxTokens: processedBody.maxTokens,
        });

        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (error) {
      if (onError) {
        return onError(error instanceof Error ? error : new Error(String(error)));
      }

      console.error('Chat handler error:', error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Internal server error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  };
}

/**
 * Transform stream chunks.
 */
async function* transformStreamChunks(
  stream: AsyncIterable<unknown>,
  transform: (chunk: string) => string
): AsyncIterable<unknown> {
  for await (const chunk of stream) {
    if (typeof chunk === 'string') {
      yield transform(chunk);
    } else if (
      chunk &&
      typeof chunk === 'object' &&
      'content' in chunk &&
      typeof (chunk as { content: string }).content === 'string'
    ) {
      yield {
        ...chunk,
        content: transform((chunk as { content: string }).content),
      };
    } else {
      yield chunk;
    }
  }
}

/**
 * Server action for chat completion.
 *
 * @example
 * ```typescript
 * // app/actions.ts
 * 'use server';
 *
 * import { createChatAction } from 'ai.matey.react.nextjs/server';
 * import { bridge } from './bridge';
 *
 * export const chatAction = createChatAction({ bridge });
 *
 * // In component:
 * const result = await chatAction({ messages: [...] });
 * ```
 */
export function createChatAction(options: { bridge: Bridge | (() => Bridge | Promise<Bridge>) }) {
  return async function chatAction(body: ChatRequestBody) {
    const bridge = typeof options.bridge === 'function' ? await options.bridge() : options.bridge;

    const response = await bridge.chat({
      messages: body.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      model: body.model,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
    });

    return response;
  };
}
