/**
 * Middleware Stack Implementation
 *
 * Composable middleware system for request/response transformation.
 * Middleware executes in order with "onion" pattern - each middleware
 * can execute code before and after calling next().
 *
 * `next()` is re-entrant: calling it more than once re-runs the remainder of
 * the chain rather than skipping ahead, so retry-shaped middleware retries the
 * same chain it ran the first time. See {@link MiddlewareStack.execute}.
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
  MiddlewareRegistrationOptions,
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
import { AdapterError, MiddlewareError } from '@johnhenry/aimatey-errors';
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
 *   partially delivered stream cannot be retried. This is the one place where
 *   a second `next()` is refused rather than served - everywhere else it
 *   re-runs the remainder of the chain (see
 *   {@link MiddlewareStack.execute}). Retry middleware still retries failures
 *   raised *by* `next()` itself, before any chunk is delivered, and such a
 *   retry re-runs the whole downstream chain.
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
 *
 * `name` is what this registration is called when it fails; `undefined` means
 * nothing better than its position is known (see {@link resolveMiddlewareName}).
 */
interface MiddlewareStackEntry {
  readonly standard?: Middleware;
  readonly streaming: StreamingMiddleware;
  readonly name?: string;
}

/**
 * Function names that identify nothing.
 *
 * A middleware built by a factory that ends in
 * `const middleware: Middleware = ...; return middleware;` reports `.name` as
 * `'middleware'` - true of `createConversationHistoryMiddleware` in this repo.
 * `Middleware "middleware" failed` is no more use than the `'unknown'` this
 * replaced, so such a name is discarded in favour of the position.
 */
const UNINFORMATIVE_FUNCTION_NAMES: ReadonlySet<string> = new Set([
  'middleware',
  'streamingMiddleware',
  'anonymous',
  'fn',
  'handler',
]);

/**
 * The name a registration should answer to, or `undefined` for "position only".
 *
 * An explicit name wins; otherwise the function's own `.name`, which is free
 * for `function rateLimit()` and for `const rateLimit = async () => {}` but
 * empty for the anonymous arrow most middleware factories return.
 *
 * Deliberately never `'unknown'`: `middlewareName` was populated with that
 * literal at four sites and with nothing at the two that actually wrap a
 * middleware failure (#71), so the one piece of provenance the wrapper exists
 * to add was always either absent or a placeholder.
 */
function resolveMiddlewareName(
  middleware: Middleware | StreamingMiddleware,
  explicit?: string
): string | undefined {
  const given = explicit?.trim();
  if (given) {
    return given;
  }

  const own = typeof middleware === 'function' ? middleware.name.trim() : '';
  if (own === '' || UNINFORMATIVE_FUNCTION_NAMES.has(own)) {
    return undefined;
  }

  return own;
}

/**
 * How a registration is referred to in an error message.
 *
 * Falls back to the registration position rather than to a placeholder - a
 * position is less useful than a name and far more useful than nothing, and it
 * is the index the caller can count off their own `use()` calls.
 */
function middlewareLabel(name: string | undefined, index: number): string {
  return name ?? `middleware[${index}]`;
}

/**
 * The boundary between the middleware chain and what runs below it.
 *
 * `call()` invokes the final handler and remembers any failure it raised, so a
 * middleware frame can tell a failure it merely *carried* from one it raised
 * itself. Marks are weakly keyed by the thrown object and scoped to a single
 * execution, so nothing is retained and no mark carries over to another
 * request.
 */
interface FinalHandlerBoundary<T> {
  /** Run the final handler, marking anything it throws. */
  readonly call: () => Promise<T>;
  /** Whether this failure came from below the stack rather than a middleware. */
  readonly raisedBelow: (error: unknown) => boolean;
}

function createFinalHandlerBoundary<T>(finalHandler: () => Promise<T>): FinalHandlerBoundary<T> {
  const raised = new WeakSet<object>();

  return {
    call: async (): Promise<T> => {
      try {
        return await finalHandler();
      } catch (error) {
        if (typeof error === 'object' && error !== null) {
          raised.add(error);
        }
        throw error;
      }
    },
    raisedBelow: (error: unknown): boolean =>
      typeof error === 'object' && error !== null && raised.has(error),
  };
}

/**
 * Whether a failure that reached a middleware frame should be re-labelled as a
 * `MiddlewareError`.
 *
 * Only failures a middleware raised *itself*, and that carry no classification
 * of their own, are wrapped - that is the one case where the wrapper adds
 * something (a code and a category for an otherwise unclassified throwable).
 *
 * Two kinds of failure are passed through untouched (#65):
 *
 * - **Already classified.** An `AdapterError` carries a code, a category and a
 *   retryability; wrapping replaced all three, so a transient `NetworkError`
 *   reached the retry middleware as a non-retryable `MiddlewareError` and
 *   `createRetryMiddleware` gave up after one attempt. `MiddlewareError` is
 *   itself an `AdapterError`, so it is re-thrown as-is here as it always was.
 * - **Raised below the stack.** The final handler runs inside the innermost
 *   frame's `next()`, so its failures used to be caught and re-labelled by the
 *   frame above - which made the error a caller saw depend on how many
 *   middleware happened to be registered (with none, the same failure
 *   propagated raw). A backend failure is not a middleware failure at any
 *   stack size.
 */
function shouldWrapAsMiddlewareError(
  error: unknown,
  boundary: FinalHandlerBoundary<unknown>
): boolean {
  if (error instanceof AdapterError) {
    return false;
  }

  return !boundary.raisedBelow(error);
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
   * Pass `{ name }` to say what this middleware is called when it fails;
   * without it the name comes from the function's own `.name`, and failing
   * that from its registration position (see {@link resolveMiddlewareName}).
   *
   * @param middleware Middleware function to add
   * @param options Registration options; `name` identifies it in errors
   * @throws {MiddlewareError} If stack is locked
   */
  use(middleware: Middleware, options?: MiddlewareRegistrationOptions): void {
    const name = resolveMiddlewareName(middleware, options?.name);
    if (this.locked) {
      throw new MiddlewareError({
        message: 'Cannot add middleware after stack is locked',
        middlewareName: name,
      });
    }
    this.entries.push({
      standard: middleware,
      streaming: adaptMiddlewareToStreaming(middleware),
      name,
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
        middlewareName: resolveMiddlewareName(middleware),
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
   * Pass `{ name }` to say what this middleware is called when it fails; see
   * {@link use}.
   *
   * @param middleware Streaming middleware function to add
   * @param options Registration options; `name` identifies it in errors
   * @throws {MiddlewareError} If stack is locked
   */
  useStreaming(middleware: StreamingMiddleware, options?: MiddlewareRegistrationOptions): void {
    const name = resolveMiddlewareName(middleware, options?.name);
    if (this.locked) {
      throw new MiddlewareError({
        message: 'Cannot add streaming middleware after stack is locked',
        middlewareName: name,
      });
    }
    this.entries.push({ streaming: middleware, name });
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
        middlewareName: resolveMiddlewareName(middleware),
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
   * ## `next()` is re-entrant
   *
   * The chain is dispatched by recursion, and every `next()` closes over its
   * own position in it. Calling `next()` more than once therefore re-runs *the
   * whole remainder of the chain*, in order, once per call - the second pass
   * takes exactly the same code path as the first.
   *
   * This is deliberate, and the reason this stack does not carry Koa's
   * "next() called multiple times" guard: retry-shaped middleware
   * (`try { return await next() } catch { return next() }`) is a first-class
   * pattern here, and the retry has to re-run the validation, redaction and
   * transform middleware registered after it or the second attempt would hit
   * the backend with a differently-prepared request. Throwing would ban a
   * useful pattern; the previous behaviour - advancing *past* the next
   * middleware and silently running a shorter chain - was the one option that
   * is never correct.
   *
   * Consequences a middleware author should know about:
   *
   * - Re-running is not free of side effects: every downstream middleware runs
   *   again, so anything they do (logging, cost tracking, cache writes) happens
   *   again too. Mutations they made to `context` on the first pass are still
   *   there on the second - `context` is shared, not snapshotted.
   * - Nothing bounds the number of passes. A middleware that calls `next()` in
   *   an unbounded loop will retry forever, exactly as an unbounded loop
   *   anywhere else would.
   * - On the streaming path the same re-entrancy applies to the chain
   *   (see {@link executeStream}), but a *standard* middleware adapted onto a
   *   stream can only retry a `next()` that failed before any chunk was
   *   delivered; see {@link adaptMiddlewareToStreaming}.
   *
   * ## Errors keep their own classification
   *
   * The stack wraps a failure in a `MiddlewareError` only when a middleware
   * raised it *itself* and it carries no classification of its own. An
   * `AdapterError` - from a middleware or from the backend - propagates
   * untouched, with its `code`, category and `isRetryable` intact, and so does
   * anything the final handler raised. The error a caller sees therefore does
   * not depend on how many middleware happen to be registered
   * (see {@link shouldWrapAsMiddlewareError}).
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

    // Built from `entries` rather than `getMiddleware()` so each frame keeps
    // the *registration* index, which is what a caller can count off their own
    // `use()` calls - the streaming path interleaves `useStreaming()` entries,
    // so a chain-local index would name the same middleware two ways.
    const chain = this.entries.flatMap((entry, index) =>
      entry.standard ? [{ run: entry.standard, label: middlewareLabel(entry.name, index) }] : []
    );

    // If no middleware, call handler directly
    if (chain.length === 0) {
      return finalHandler();
    }

    const boundary = createFinalHandlerBoundary(finalHandler);

    // Compose middleware chain. `index` is a parameter rather than shared
    // mutable state, so each `next()` re-enters at its own position.
    const dispatch = async (index: number): Promise<IRChatResponse> => {
      const frame = chain[index];
      if (!frame) {
        // End of middleware chain, call final handler
        return boundary.call();
      }

      const next: MiddlewareNext = () => dispatch(index + 1);

      try {
        return await frame.run(context, next);
      } catch (error) {
        // Wrap only what this middleware raised itself and left unclassified
        if (!shouldWrapAsMiddlewareError(error, boundary)) {
          throw error;
        }
        throw new MiddlewareError({
          message: `Middleware "${frame.label}" failed: ${error instanceof Error ? error.message : String(error)}`,
          middlewareName: frame.label,
          cause: error instanceof Error ? error : undefined,
          irState: {
            request: context.request,
          },
        });
      }
    };

    return dispatch(0);
  }

  /**
   * Execute middleware stack for streaming requests.
   *
   * Runs every registration in the stack - stream-native middleware added with
   * {@link useStreaming} and, adapted, every middleware added with
   * {@link use} - in registration order.
   *
   * ## `next()` is re-entrant
   *
   * As on the non-streaming path (see {@link execute}), each `next()` closes
   * over its own position in the chain, so calling it more than once re-runs
   * the whole remainder of the chain and starts a *fresh* stream each time.
   *
   * The two `next()` guards in this file answer different questions and do not
   * conflict:
   *
   * - **This dispatcher** decides what a second `next()` *reaches*: the same
   *   chain the first one did, never a shorter one.
   * - **{@link adaptMiddlewareToStreaming}** decides whether a *standard*
   *   middleware may make that second call at all. Once its first `next()` has
   *   handed a stream to the consumer, the chunks are already gone and no
   *   restart can reach the consumer, so the adapter throws a
   *   `MiddlewareError` rather than start a stream nobody can read. Before any
   *   chunk is delivered - i.e. when the first `next()` *failed* - it lets the
   *   call through, and that retry now re-runs the whole downstream chain
   *   instead of skipping the middleware next to it.
   *
   * A {@link StreamingMiddleware} registered with {@link useStreaming} owns the
   * `IRChatStream` itself rather than receiving an assembled response, so it
   * has no such restriction: it may call `next()` as often as it likes and
   * choose which of the resulting streams to return. Streams it abandons are
   * never iterated.
   *
   * ## Errors keep their own classification
   *
   * As on the non-streaming path (see {@link execute}), only a failure a
   * middleware raised itself and left unclassified is wrapped in a
   * `MiddlewareError`. A failure raised while the stream is *consumed* never
   * reaches this dispatcher at all - it is rethrown by
   * {@link adaptMiddlewareToStreaming}'s pass-through, unchanged.
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

    const chain = this.entries.map((entry, index) => ({
      run: entry.streaming,
      label: middlewareLabel(entry.name, index),
    }));

    // If no middleware at all, call handler directly
    if (chain.length === 0) {
      return finalHandler();
    }

    const boundary = createFinalHandlerBoundary(finalHandler);

    // Compose streaming middleware chain. `index` is a parameter rather than
    // shared mutable state, so each `next()` re-enters at its own position.
    const dispatch = async (index: number): Promise<IRChatStream> => {
      const frame = chain[index];
      if (!frame) {
        // End of middleware chain, call final handler
        return boundary.call();
      }

      const next: StreamingMiddlewareNext = () => dispatch(index + 1);

      try {
        return await frame.run(context, next);
      } catch (error) {
        // Wrap only what this middleware raised itself and left unclassified
        if (!shouldWrapAsMiddlewareError(error, boundary)) {
          throw error;
        }
        throw new MiddlewareError({
          message: `Streaming middleware "${frame.label}" failed: ${error instanceof Error ? error.message : String(error)}`,
          middlewareName: frame.label,
          cause: error instanceof Error ? error : undefined,
          irState: {
            request: context.request,
          },
        });
      }
    };

    return dispatch(0);
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
