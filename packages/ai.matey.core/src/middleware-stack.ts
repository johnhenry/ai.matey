/**
 * Middleware Stack Implementation
 *
 * Composable middleware system for request/response transformation.
 * Middleware executes in order with "onion" pattern - each middleware
 * can execute code before and after calling next().
 *
 * A single stack drives both the non-streaming and the streaming path.
 * Middleware registered with {@link MiddlewareStack.use} runs on both:
 * on the streaming path it is wrapped by {@link adaptMiddlewareToStreaming}.
 * Middleware registered with {@link MiddlewareStack.useStreaming} is
 * stream-native and runs on the streaming path only.
 *
 * @module
 */

import type {
  BackendAdapter,
  Middleware,
  MiddlewareContext,
  MiddlewareNext,
  StreamingMiddleware,
  StreamingMiddlewareContext,
  StreamingMiddlewareNext,
} from '@johnhenry/aimatey-types';
import type {
  FinishReason,
  IRChatRequest,
  IRChatResponse,
  IRChatStream,
  IRMessage,
  IRMetadata,
  IRStreamChunk,
  IRUsage,
  IRWarning,
  StreamDoneChunk,
} from '@johnhenry/aimatey-types';
import { MiddlewareError } from '@johnhenry/aimatey-errors';
import {
  accumulateChunk,
  accumulatorToMessage,
  createStreamAccumulator,
  createWarning,
} from '@johnhenry/aimatey-utils';

// ============================================================================
// Streaming Adapter
// ============================================================================

/**
 * Marker set on `metadata.custom` of the response handed to a standard
 * middleware while it runs on the streaming path.
 *
 * Middleware that must distinguish a real non-streaming response from one
 * assembled after a stream completed can check for this flag (in addition to
 * the always-available `context.isStreaming`).
 */
export const ASSEMBLED_FROM_STREAM = 'assembledFromStream';

/**
 * Minimal deferred promise.
 */
interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly settled: boolean;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

function createDeferred<T>(): Deferred<T> {
  let resolveFn!: (value: T) => void;
  let rejectFn!: (reason: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });
  let settled = false;

  return {
    promise,
    get settled() {
      return settled;
    },
    resolve(value: T): void {
      if (settled) {
        return;
      }
      settled = true;
      resolveFn(value);
    },
    reject(reason: unknown): void {
      if (settled) {
        return;
      }
      settled = true;
      rejectFn(reason);
    },
  };
}

type Outcome<T> =
  | { readonly status: 'fulfilled'; readonly value: T }
  | {
      readonly status: 'rejected';
      readonly reason: unknown;
    };

/**
 * Observe a promise without ever rejecting, so it can be raced and awaited
 * repeatedly without producing unhandled rejections.
 */
function settle<T>(promise: Promise<T>): Promise<Outcome<T>> {
  return promise.then(
    (value): Outcome<T> => ({ status: 'fulfilled', value }),
    (reason: unknown): Outcome<T> => ({ status: 'rejected', reason })
  );
}

/**
 * Extract plain text from an IR message.
 */
function messageToText(message: IRMessage): string {
  if (typeof message.content === 'string') {
    return message.content;
  }
  return message.content.map((block) => (block.type === 'text' ? block.text : '')).join('');
}

/**
 * Replay a complete response as a stream.
 *
 * Used when a standard middleware short-circuits a streaming request (a cache
 * hit, a canned refusal, a stubbed response) and never calls `next()`. The
 * chunk boundaries are synthetic, so a `capability-unsupported` warning is
 * attached to the start chunk to document the drift.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- async generator: the response is already resolved, there is nothing to await
async function* replayResponseAsStream(response: IRChatResponse): IRChatStream {
  const warning = createWarning(
    'capability-unsupported',
    'Stream synthesized from a complete response supplied by middleware ' +
      '(the middleware short-circuited without calling next()). Chunk boundaries are synthetic.',
    { severity: 'info', field: 'stream', source: 'middleware-stack' }
  );

  let sequence = 0;

  yield {
    type: 'start',
    sequence: sequence++,
    metadata: {
      ...response.metadata,
      warnings: [...(response.metadata.warnings ?? []), warning],
    },
  };

  const text = messageToText(response.message);
  if (text.length > 0) {
    yield {
      type: 'content',
      sequence: sequence++,
      delta: text,
      accumulated: text,
      role: 'assistant',
    };
  }

  yield {
    type: 'done',
    sequence: sequence++,
    finishReason: response.finishReason,
    usage: response.usage,
    message: response.message,
  };
}

/**
 * Adapt a standard {@link Middleware} so it can run on the streaming path.
 *
 * The adapted middleware preserves the full onion shape:
 *
 * 1. **Request phase** - everything the middleware does before `await next()`
 *    runs before the backend is called, exactly as on the non-streaming path.
 *    Reassignments of `context.request` are therefore visible to the backend
 *    (the Bridge reads `context.request` when it calls the backend).
 * 2. **`next()`** - obtains the real `IRChatStream` from the rest of the chain
 *    and hands it back to the caller immediately, so chunks are delivered with
 *    no added latency and no buffering delay.
 * 3. **Response phase** - everything after `await next()` runs once the stream
 *    has been fully consumed, with a *real* `IRChatResponse` assembled from the
 *    chunks that were delivered. Observational middleware (logging, telemetry,
 *    cost tracking, caching, conversation history) therefore sees genuine
 *    content, usage and finish reason rather than a placeholder.
 *
 * ## Deliberate limitations
 *
 * - **Response mutations are not delivered.** The chunks have already reached
 *   the consumer by the time the response phase runs, so a middleware that
 *   returns a *modified* response cannot change what was streamed. The
 *   assembled response carries an explicit `capability-unsupported` warning and
 *   a `metadata.custom.assembledFromStream` flag documenting this.
 * - **The response phase runs late.** Errors thrown after `await next()`
 *   surface while the consumer is iterating the stream, not from the
 *   `executeStream()` call itself. Errors thrown *before* `next()` propagate
 *   from `executeStream()` exactly as they do from `execute()`.
 * - **A stream cannot be restarted.** Calling `next()` a second time after a
 *   stream has been handed to the consumer throws a `MiddlewareError`; a
 *   partially delivered stream cannot be retried. (Retry middleware still
 *   retries failures raised *by* `next()` itself, before any chunk is
 *   delivered.)
 * - **A consumer that abandons the stream** (breaks out of the loop, aborts)
 *   still runs the response phase, with a partial response whose
 *   `finishReason` is `cancelled`.
 *
 * Middleware that needs true chunk-level control should be written as a
 * {@link StreamingMiddleware} and registered with `useStreaming()` instead.
 *
 * @param middleware Standard middleware to adapt
 * @returns Streaming middleware wrapping it
 */
export function adaptMiddlewareToStreaming(middleware: Middleware): StreamingMiddleware {
  return async function adaptedStreamingMiddleware(
    context: StreamingMiddlewareContext,
    next: StreamingMiddlewareNext
  ): Promise<IRChatStream> {
    const streamDeferred = createDeferred<IRChatStream>();
    const responseDeferred = createDeferred<IRChatResponse>();

    // The middleware may abandon the response promise (short-circuit, or a
    // consumer that never drains the stream). Mark it handled up front so a
    // later rejection can never surface as an unhandled rejection; every real
    // consumer still observes the rejection through its own `await`.
    void responseDeferred.promise.catch(() => undefined);

    const adaptedNext: MiddlewareNext = async (): Promise<IRChatResponse> => {
      if (streamDeferred.settled) {
        throw new MiddlewareError({
          message:
            'next() was called more than once on a streaming request. A stream that has ' +
            'already been handed to the consumer cannot be restarted; use a StreamingMiddleware ' +
            '(bridge.useStreaming) for chunk-level control.',
        });
      }
      const stream = await next();
      streamDeferred.resolve(stream);
      return responseDeferred.promise;
    };

    // Never awaited directly - awaiting the middleware here would deadlock,
    // because it is itself waiting for the stream to be consumed.
    const outcome = settle(middleware(context, adaptedNext));

    // Whichever happens first: the chain produced a stream, or the middleware
    // finished without one (it threw, or it short-circuited).
    await Promise.race([streamDeferred.promise, outcome]);

    if (!streamDeferred.settled) {
      const finished = await outcome;
      if (finished.status === 'rejected') {
        throw finished.reason;
      }
      return replayResponseAsStream(finished.value);
    }

    const source = await streamDeferred.promise;

    return passThroughStream(source, context, responseDeferred, outcome);
  };
}

/**
 * Pass chunks straight through while accumulating them, then run the
 * middleware's response phase against the assembled response.
 */
async function* passThroughStream(
  source: IRChatStream,
  context: StreamingMiddlewareContext,
  responseDeferred: Deferred<IRChatResponse>,
  outcome: Promise<Outcome<IRChatResponse>>
): IRChatStream {
  let accumulator = createStreamAccumulator();
  let startMetadata: IRMetadata | undefined;
  let doneChunk: StreamDoneChunk | undefined;
  let usage: IRUsage | undefined;
  let completed = false;

  const capture = (chunk: IRStreamChunk): void => {
    accumulator = accumulateChunk(accumulator, chunk);
    if (chunk.type === 'start') {
      startMetadata ??= chunk.metadata;
    } else if (chunk.type === 'metadata') {
      if (chunk.usage) {
        usage = { ...usage, ...chunk.usage } as IRUsage;
      }
    } else if (chunk.type === 'done') {
      doneChunk = chunk;
    }
  };

  const assemble = (): IRChatResponse => {
    const base = startMetadata ?? context.request.metadata;
    const merged: IRMetadata = {
      ...base,
      ...accumulator.metadata,
      requestId: accumulator.metadata?.requestId ?? base.requestId,
      timestamp: accumulator.metadata?.timestamp ?? base.timestamp,
    };

    const warning: IRWarning = createWarning(
      'capability-unsupported',
      'Response assembled from a stream after its chunks were delivered. Middleware may ' +
        'observe it, but changes made to it are not reflected in the delivered stream.',
      { severity: 'info', field: 'response', source: 'middleware-stack' }
    );

    const finishReason: FinishReason =
      doneChunk?.finishReason ?? (completed ? 'stop' : 'cancelled');

    return {
      message: doneChunk?.message ?? accumulatorToMessage(accumulator),
      finishReason,
      usage: doneChunk?.usage ?? usage,
      metadata: {
        ...merged,
        warnings: [...(merged.warnings ?? []), warning],
        custom: {
          ...merged.custom,
          [ASSEMBLED_FROM_STREAM]: true,
        },
      },
    };
  };

  // Tracks whether the response phase has already been kicked off, so each of
  // the three exits below runs it exactly once.
  let responsePhaseStarted = false;
  let responsePhaseError: { readonly reason: unknown } | undefined;

  try {
    for await (const chunk of source) {
      capture(chunk);
      yield chunk;
    }

    // Normal completion: hand the middleware the assembled response and let its
    // response phase finish before the stream ends.
    completed = true;
    const assembled = assemble();
    responsePhaseStarted = true;
    responseDeferred.resolve(assembled);
    const finished = await outcome;
    if (finished.status === 'rejected') {
      responsePhaseError = { reason: finished.reason };
    }
  } catch (error) {
    // The stream itself failed. Let the middleware observe the failure, then
    // rethrow it - a response-phase failure never displaces the real cause.
    if (!responsePhaseStarted) {
      responsePhaseStarted = true;
      responseDeferred.reject(error);
      await outcome;
    }
    throw error;
  } finally {
    // Only reached un-started when the consumer abandoned the stream (broke out
    // of the loop, aborted). The response phase still runs, against a partial
    // response; an error it raises has nowhere to go and is dropped.
    if (!responsePhaseStarted) {
      responsePhaseStarted = true;
      responseDeferred.resolve(assemble());
      await outcome;
    }
  }

  if (responsePhaseError) {
    throw responsePhaseError.reason;
  }
}

// ============================================================================
// Middleware Stack
// ============================================================================

/**
 * One registration in the stack.
 *
 * `standard` is set only for middleware registered through `use()`; it is the
 * caller's original function, kept for `getMiddleware()`/`remove()` identity.
 * `streaming` is what actually runs on the streaming path - the adapted
 * wrapper for standard middleware, or the function itself for stream-native
 * middleware.
 */
interface MiddlewareStackEntry {
  readonly standard?: Middleware;
  readonly streaming: StreamingMiddleware;
}

/**
 * Middleware stack for composing middleware functions.
 *
 * Executes middleware in order with proper error handling and context management.
 */
export class MiddlewareStack {
  /** Registrations in call order, across both `use()` and `useStreaming()`. */
  private entries: MiddlewareStackEntry[] = [];
  private locked: boolean = false;

  /**
   * Add middleware to the stack.
   *
   * The middleware runs on both the non-streaming and the streaming path; see
   * {@link adaptMiddlewareToStreaming} for how it is adapted to streams and
   * what that cannot do.
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
    this.entries.push({
      standard: middleware,
      streaming: adaptMiddlewareToStreaming(middleware),
    });
  }

  /**
   * Remove middleware from the stack.
   *
   * Removes it from both the non-streaming and the streaming path.
   *
   * @param middleware Middleware function to remove
   * @returns true if middleware was found and removed, false otherwise
   * @throws {MiddlewareError} If stack is locked
   */
  remove(middleware: Middleware): boolean {
    if (this.locked) {
      throw new MiddlewareError({
        message: 'Cannot remove middleware after stack is locked',
        middlewareName: 'unknown',
      });
    }
    const index = this.entries.findIndex((entry) => entry.standard === middleware);
    if (index !== -1) {
      this.entries.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Add streaming middleware to the stack.
   *
   * Stream-native middleware runs on the streaming path only, interleaved with
   * `use()` middleware in registration order.
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
    this.entries.push({ streaming: middleware });
  }

  /**
   * Remove streaming middleware from the stack.
   *
   * Only removes middleware registered through {@link useStreaming}; use
   * {@link remove} for middleware registered through {@link use}.
   *
   * @param middleware Streaming middleware function to remove
   * @returns true if middleware was found and removed, false otherwise
   * @throws {MiddlewareError} If stack is locked
   */
  removeStreaming(middleware: StreamingMiddleware): boolean {
    if (this.locked) {
      throw new MiddlewareError({
        message: 'Cannot remove streaming middleware after stack is locked',
        middlewareName: 'unknown',
      });
    }
    const index = this.entries.findIndex(
      (entry) => entry.standard === undefined && entry.streaming === middleware
    );
    if (index !== -1) {
      this.entries.splice(index, 1);
      return true;
    }
    return false;
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
   * Get all middleware registered through {@link use}, in order.
   */
  getMiddleware(): readonly Middleware[] {
    return this.entries.flatMap((entry) => (entry.standard ? [entry.standard] : []));
  }

  /**
   * Get all stream-native middleware registered through {@link useStreaming},
   * in order.
   *
   * Middleware registered through {@link use} also runs on the streaming path
   * (adapted), but is reported by {@link getMiddleware} rather than here.
   */
  getStreamingMiddleware(): readonly StreamingMiddleware[] {
    return this.entries.flatMap((entry) => (entry.standard === undefined ? [entry.streaming] : []));
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

    const chain = this.getMiddleware();

    // If no middleware, call handler directly
    if (chain.length === 0) {
      return finalHandler();
    }

    // Compose middleware chain
    let index = 0;

    const next: MiddlewareNext = async (): Promise<IRChatResponse> => {
      if (index >= chain.length) {
        // End of middleware chain, call final handler
        return finalHandler();
      }

      const middlewareFn = chain[index];
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
   * Runs every registration in the stack - stream-native middleware added with
   * {@link useStreaming} and, adapted, every middleware added with
   * {@link use} - in registration order.
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

    const chain = this.entries.map((entry) => entry.streaming);

    // If no middleware at all, call handler directly
    if (chain.length === 0) {
      return finalHandler();
    }

    // Compose streaming middleware chain
    let index = 0;

    const next: StreamingMiddlewareNext = async (): Promise<IRChatStream> => {
      if (index >= chain.length) {
        // End of middleware chain, call final handler
        return finalHandler();
      }

      const middlewareFn = chain[index];
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
    this.entries = [];
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
 * @param backend Backend the request is about to be dispatched to. Populates
 *   `context.backend` and `context.backendName` so middleware can execute an extra
 *   turn of its own; omit it only when building a context by hand.
 * @returns Middleware context
 */
export function createMiddlewareContext(
  request: IRChatRequest,
  config: Record<string, unknown>,
  signal?: AbortSignal,
  backend?: BackendAdapter
): MiddlewareContext {
  return {
    request,
    isStreaming: request.stream ?? false,
    backend,
    backendName: backend?.metadata.name,
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
 * @param backend Backend the request is about to be dispatched to. See
 *   {@link createMiddlewareContext}.
 * @returns Streaming middleware context
 */
export function createStreamingMiddlewareContext(
  request: IRChatRequest,
  config: Record<string, unknown>,
  signal?: AbortSignal,
  backend?: BackendAdapter
): StreamingMiddlewareContext {
  return {
    request,
    isStreaming: true,
    backend,
    backendName: backend?.metadata.name,
    state: {},
    config,
    signal,
    chunksProcessed: 0,
    streamComplete: false,
  };
}
