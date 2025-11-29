/**
 * Transform Middleware
 *
 * Transforms requests and responses with custom functions.
 *
 * @module
 */

import type { Middleware, MiddlewareContext, MiddlewareNext } from 'ai.matey.types';
import type { IRChatRequest, IRChatResponse, IRMessage } from 'ai.matey.types';

// ============================================================================
// Types
// ============================================================================

/**
 * Request transformer function.
 */
export type RequestTransformer = (request: IRChatRequest) => IRChatRequest | Promise<IRChatRequest>;

/**
 * Response transformer function.
 */
export type ResponseTransformer = (
  response: IRChatResponse
) => IRChatResponse | Promise<IRChatResponse>;

/**
 * Message transformer function.
 */
export type MessageTransformer = (message: IRMessage) => IRMessage | Promise<IRMessage>;

/**
 * Configuration for transform middleware.
 */
export interface TransformConfig {
  /**
   * Transform function to apply to requests.
   */
  transformRequest?: RequestTransformer;

  /**
   * Transform function to apply to responses.
   */
  transformResponse?: ResponseTransformer;

  /**
   * Transform function to apply to each message in request.
   */
  transformMessages?: MessageTransformer;
}

// ============================================================================
// Middleware Factory
// ============================================================================

/**
 * Create transform middleware.
 *
 * Applies custom transformations to requests and responses.
 *
 * @param config Transform configuration
 * @returns Transform middleware
 *
 * @example
 * ```typescript
 * // Add system message prefix
 * const transform = createTransformMiddleware({
 *   transformRequest: (request) => ({
 *     ...request,
 *     messages: [
 *       { role: 'system', content: 'You are helpful.' },
 *       ...request.messages
 *     ]
 *   })
 * });
 *
 * bridge.use(transform);
 * ```
 */
export function createTransformMiddleware(config: TransformConfig = {}): Middleware {
  const { transformRequest, transformResponse, transformMessages } = config;

  return async (context: MiddlewareContext, next: MiddlewareNext): Promise<IRChatResponse> => {
    let request = context.request;

    // Apply message transformations
    if (transformMessages) {
      const transformedMessages = await Promise.all(
        request.messages.map((msg) => Promise.resolve(transformMessages(msg)))
      );

      request = {
        ...request,
        messages: transformedMessages,
      };
    }

    // Apply request transformation
    if (transformRequest) {
      request = await transformRequest(request);
    }

    // Update context with transformed request
    context.request = request;

    // Call next middleware/handler
    let response = await next();

    // Apply response transformation
    if (transformResponse) {
      response = await transformResponse(response);
    }

    return response;
  };
}

// ============================================================================
// Built-in Transformers
// ============================================================================

/**
 * Create a prompt rewriting transformer.
 *
 * @param rewriter Function to rewrite prompt text
 * @returns Message transformer
 *
 * @example
 * ```typescript
 * const transformer = createPromptRewriter((text) => {
 *   return text.replace(/foo/g, 'bar');
 * });
 * ```
 */
export function createPromptRewriter(
  rewriter: (text: string) => string | Promise<string>
): MessageTransformer {
  return async (message: IRMessage): Promise<IRMessage> => {
    // Only transform text content
    if (typeof message.content === 'string') {
      return {
        ...message,
        content: await rewriter(message.content),
      };
    }

    // Transform text in content blocks
    if (Array.isArray(message.content)) {
      const transformedContent = await Promise.all(
        message.content.map(async (block) => {
          if (block.type === 'text') {
            return {
              ...block,
              text: await rewriter(block.text),
            };
          }
          return block;
        })
      );

      return {
        ...message,
        content: transformedContent,
      };
    }

    return message;
  };
}

/**
 * Create a parameter modifier transformer.
 *
 * @param modifier Function to modify parameters
 * @returns Request transformer
 *
 * @example
 * ```typescript
 * const transformer = createParameterModifier((params) => ({
 *   ...params,
 *   temperature: Math.min(params.temperature ?? 0.7, 0.9)
 * }));
 * ```
 */
export function createParameterModifier(
  modifier: (
    params: IRChatRequest['parameters']
  ) => IRChatRequest['parameters'] | Promise<IRChatRequest['parameters']>
): RequestTransformer {
  return async (request: IRChatRequest): Promise<IRChatRequest> => {
    return {
      ...request,
      parameters: await modifier(request.parameters),
    };
  };
}

/**
 * Create a response filter transformer.
 *
 * @param filter Function to filter/modify response
 * @returns Response transformer
 *
 * @example
 * ```typescript
 * const transformer = createResponseFilter((response) => {
 *   // Remove custom metadata
 *   const { custom, ...metadata } = response.metadata;
 *   return { ...response, metadata };
 * });
 * ```
 */
export function createResponseFilter(
  filter: (response: IRChatResponse) => IRChatResponse | Promise<IRChatResponse>
): ResponseTransformer {
  return filter;
}

/**
 * Create a system message injector.
 *
 * @param systemMessage System message to inject
 * @param position Where to inject ('start' or 'end')
 * @returns Request transformer
 *
 * @example
 * ```typescript
 * const transformer = createSystemMessageInjector(
 *   'You are a helpful assistant.',
 *   'start'
 * );
 * ```
 */
export function createSystemMessageInjector(
  systemMessage: string,
  position: 'start' | 'end' = 'start'
): RequestTransformer {
  return (request: IRChatRequest): IRChatRequest => {
    const systemMsg: IRMessage = {
      role: 'system',
      content: systemMessage,
    };

    const messages =
      position === 'start' ? [systemMsg, ...request.messages] : [...request.messages, systemMsg];

    return {
      ...request,
      messages,
    };
  };
}

/**
 * Create a message filter transformer.
 *
 * @param predicate Function to determine if message should be kept
 * @returns Request transformer
 *
 * @example
 * ```typescript
 * // Remove all system messages
 * const transformer = createMessageFilter(
 *   (msg) => msg.role !== 'system'
 * );
 * ```
 */
export function createMessageFilter(
  predicate: (message: IRMessage) => boolean | Promise<boolean>
): RequestTransformer {
  return async (request: IRChatRequest): Promise<IRChatRequest> => {
    const filteredMessages = [];

    for (const message of request.messages) {
      if (await predicate(message)) {
        filteredMessages.push(message);
      }
    }

    return {
      ...request,
      messages: filteredMessages,
    };
  };
}

/**
 * Create a content sanitizer transformer.
 *
 * @param sanitizer Function to sanitize message content
 * @returns Message transformer
 *
 * @example
 * ```typescript
 * // Remove sensitive data
 * const transformer = createContentSanitizer((text) => {
 *   return text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');
 * });
 * ```
 */
export function createContentSanitizer(
  sanitizer: (text: string) => string | Promise<string>
): MessageTransformer {
  return createPromptRewriter(sanitizer);
}

/**
 * Compose multiple request transformers.
 *
 * @param transformers Request transformers to compose
 * @returns Composed request transformer
 *
 * @example
 * ```typescript
 * const composed = composeRequestTransformers(
 *   createSystemMessageInjector('Be helpful'),
 *   createParameterModifier(params => ({ ...params, temperature: 0.7 }))
 * );
 * ```
 */
export function composeRequestTransformers(
  ...transformers: RequestTransformer[]
): RequestTransformer {
  return async (request: IRChatRequest): Promise<IRChatRequest> => {
    let result = request;

    for (const transformer of transformers) {
      result = await transformer(result);
    }

    return result;
  };
}

/**
 * Compose multiple response transformers.
 *
 * @param transformers Response transformers to compose
 * @returns Composed response transformer
 */
export function composeResponseTransformers(
  ...transformers: ResponseTransformer[]
): ResponseTransformer {
  return async (response: IRChatResponse): Promise<IRChatResponse> => {
    let result = response;

    for (const transformer of transformers) {
      result = await transformer(result);
    }

    return result;
  };
}

/**
 * Compose multiple message transformers.
 *
 * @param transformers Message transformers to compose
 * @returns Composed message transformer
 */
export function composeMessageTransformers(
  ...transformers: MessageTransformer[]
): MessageTransformer {
  return async (message: IRMessage): Promise<IRMessage> => {
    let result = message;

    for (const transformer of transformers) {
      result = await transformer(result);
    }

    return result;
  };
}
