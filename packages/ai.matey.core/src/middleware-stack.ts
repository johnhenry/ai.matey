/**
 * Middleware Stack Implementation
 *
 * Composable middleware system for request/response transformation.
 * Middleware executes in order with "onion" pattern - each middleware
 * can execute code before and after calling next().
 *
 * @module
 */

import type {
  Middleware,
  MiddlewareContext,
  MiddlewareNext,
  StreamingMiddleware,
  StreamingMiddlewareContext,
  StreamingMiddlewareNext,
} from 'ai.matey.types';
import type { IRChatRequest, IRChatResponse, IRChatStream } from 'ai.matey.types';
import { MiddlewareError } from 'ai.matey.errors';

// ============================================================================
// Middleware Stack
// ============================================================================

/**
 * Middleware stack for composing middleware functions.
 *
 * Executes middleware in order with proper error handling and context management.
 */
export class MiddlewareStack {
  private middleware: Middleware[] = [];
  private streamingMiddleware: StreamingMiddleware[] = [];
  private locked: boolean = false;

  /**
   * Add middleware to the stack.
   *
   * @param middleware Middleware function to add
   * @throws {MiddlewareError} If stack is locked
   */
  use(middleware: Middleware): void {
    if (this.locked) {
      throw new MiddlewareError({
        message: 'Cannot add middleware after stack is locked',
        middlewareName: 'unknown',
      });
    }
    this.middleware.push(middleware);
  }

  /**
   * Add streaming middleware to the stack.
   *
   * @param middleware Streaming middleware function to add
   * @throws {MiddlewareError} If stack is locked
   */
  useStreaming(middleware: StreamingMiddleware): void {
    if (this.locked) {
      throw new MiddlewareError({
        message: 'Cannot add streaming middleware after stack is locked',
        middlewareName: 'unknown',
      });
    }
    this.streamingMiddleware.push(middleware);
  }

  /**
   * Lock the stack to prevent further modifications.
   *
   * Called automatically on first request execution.
   */
  lock(): void {
    this.locked = true;
  }

  /**
   * Get all middleware in the stack.
   */
  getMiddleware(): readonly Middleware[] {
    return [...this.middleware];
  }

  /**
   * Get all streaming middleware in the stack.
   */
  getStreamingMiddleware(): readonly StreamingMiddleware[] {
    return [...this.streamingMiddleware];
  }

  /**
   * Check if stack is locked.
   */
  isLocked(): boolean {
    return this.locked;
  }

  /**
   * Execute middleware stack for non-streaming requests.
   *
   * @param context Middleware context
   * @param finalHandler Final handler function (backend.execute)
   * @returns Response after middleware chain
   */
  async execute(
    context: MiddlewareContext,
    finalHandler: () => Promise<IRChatResponse>
  ): Promise<IRChatResponse> {
    // Lock stack on first execution
    if (!this.locked) {
      this.lock();
    }

    // If no middleware, call handler directly
    if (this.middleware.length === 0) {
      return finalHandler();
    }

    // Compose middleware chain
    let index = 0;

    const next: MiddlewareNext = async (): Promise<IRChatResponse> => {
      if (index >= this.middleware.length) {
        // End of middleware chain, call final handler
        return finalHandler();
      }

      const middlewareFn = this.middleware[index];
      if (!middlewareFn) {
        // End of middleware chain, call final handler
        return finalHandler();
      }
      index++;

      try {
        return await middlewareFn(context, next);
      } catch (error) {
        // Re-throw as MiddlewareError if not already
        if (error instanceof MiddlewareError) {
          throw error;
        }
        throw new MiddlewareError({
          message: `Middleware execution failed: ${error instanceof Error ? error.message : String(error)}`,
          cause: error instanceof Error ? error : undefined,
          irState: {
            request: context.request,
          },
        });
      }
    };

    return next();
  }

  /**
   * Execute middleware stack for streaming requests.
   *
   * @param context Streaming middleware context
   * @param finalHandler Final handler function (backend.executeStream)
   * @returns Stream after middleware chain
   */
  async executeStream(
    context: StreamingMiddlewareContext,
    finalHandler: () => Promise<IRChatStream>
  ): Promise<IRChatStream> {
    // Lock stack on first execution
    if (!this.locked) {
      this.lock();
    }

    // If no streaming middleware, call handler directly
    if (this.streamingMiddleware.length === 0) {
      return finalHandler();
    }

    // Compose streaming middleware chain
    let index = 0;

    const next: StreamingMiddlewareNext = async (): Promise<IRChatStream> => {
      if (index >= this.streamingMiddleware.length) {
        // End of middleware chain, call final handler
        return finalHandler();
      }

      const middlewareFn = this.streamingMiddleware[index];
      if (!middlewareFn) {
        // End of middleware chain, call final handler
        return finalHandler();
      }
      index++;

      try {
        return await middlewareFn(context, next);
      } catch (error) {
        // Re-throw as MiddlewareError if not already
        if (error instanceof MiddlewareError) {
          throw error;
        }
        throw new MiddlewareError({
          message: `Streaming middleware execution failed: ${error instanceof Error ? error.message : String(error)}`,
          cause: error instanceof Error ? error : undefined,
          irState: {
            request: context.request,
          },
        });
      }
    };

    return next();
  }

  /**
   * Clear all middleware from the stack.
   *
   * @throws {MiddlewareError} If stack is locked
   */
  clear(): void {
    if (this.locked) {
      throw new MiddlewareError({
        message: 'Cannot clear middleware after stack is locked',
      });
    }
    this.middleware = [];
    this.streamingMiddleware = [];
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create middleware context from request and config.
 *
 * @param request IR request
 * @param config Bridge configuration
 * @param signal Optional abort signal
 * @returns Middleware context
 */
export function createMiddlewareContext(
  request: IRChatRequest,
  config: Record<string, unknown>,
  signal?: AbortSignal
): MiddlewareContext {
  return {
    request,
    isStreaming: request.stream ?? false,
    state: {},
    config,
    signal,
  };
}

/**
 * Create streaming middleware context from request and config.
 *
 * @param request IR request
 * @param config Bridge configuration
 * @param signal Optional abort signal
 * @returns Streaming middleware context
 */
export function createStreamingMiddlewareContext(
  request: IRChatRequest,
  config: Record<string, unknown>,
  signal?: AbortSignal
): StreamingMiddlewareContext {
  return {
    request,
    isStreaming: true,
    state: {},
    config,
    signal,
    chunksProcessed: 0,
    streamComplete: false,
  };
}
