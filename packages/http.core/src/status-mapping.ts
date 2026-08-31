/**
 * Error -> HTTP status mapping.
 *
 * The single implementation for the whole package. It lives in its own module
 * rather than beside one of its callers because it has two: `error-handler.ts`
 * (which re-exports it, preserving the public entry point) and `handler.ts`.
 *
 * Before #105 those two files each carried their own copy, and the copies
 * disagreed about identical input:
 *
 * | input                | handler.ts | error-handler.ts |
 * | -------------------- | ---------- | ---------------- |
 * | message `timeout`    | 408        | 504              |
 * | message `conflict`   | 409        | 500              |
 * | message `validation` | 400        | 500              |
 * | message `too large`  | 500        | 413              |
 * | `RateLimitError`     | 500        | 429              |
 * | `NetworkError`       | 500        | 502              |
 * | `ProviderError`      | 500        | 503              |
 * | `ValidationError`    | 500        | 400              |
 *
 * Which status a caller saw depended only on which code path happened to
 * handle the error. `handler.ts`'s copy was strictly the weaker of the two: it
 * sniffed messages and ignored the typed error taxonomy completely.
 *
 * This function is the **union** of both, so unifying dropped nothing:
 * `conflict` and `validation` came from `handler.ts`, `too large` and the
 * typed taxonomy from `error-handler.ts`.
 *
 * @module
 */

import {
  AdapterError,
  ValidationError,
  AuthenticationError,
  RateLimitError,
  NetworkError,
  ProviderError,
  StreamError,
} from '@johnhenry/aimatey-errors';

/**
 * The status an error deliberately declares for the response we are about to
 * send, if it declares one.
 *
 * Read only from `details.httpStatus`, which is set by code raising an error
 * *for* a response of ours. Deliberately NOT read from `httpContext.statusCode`
 * -- that records what an *upstream provider* answered, and echoing an upstream
 * status as our own would turn e.g. a provider's 404 into our 404 rather than
 * the 502/503 that describes our own failure to serve the request.
 *
 * Declaring the status this way lets a raiser ask for e.g. 413 without the
 * mapping having to infer it from message text, which breaks silently the first
 * time someone rewords the message.
 */
function explicitStatusCode(error: Error): number | undefined {
  const details = (error as AdapterError).details;
  const declared = details?.['httpStatus'];

  if (typeof declared === 'number' && declared >= 400 && declared <= 599) {
    return declared;
  }

  return undefined;
}

/**
 * Get HTTP status code from error.
 *
 * Exported so that every HTTP entry point maps errors to statuses the same way
 * instead of hardcoding a number at each catch site. `CoreHTTPHandler` had its
 * own private duplicate of this until #105; it now calls this.
 *
 * Order matters and is deliberate: an explicitly declared status wins over
 * everything, the typed taxonomy is consulted before any message text, and
 * message sniffing is the last resort. Within the message checks the order is
 * the pre-existing one from `error-handler.ts`, which is the copy that was
 * already exported and already depended on by `packages/http/src/node/listener.ts`.
 */
export function getHTTPStatusCode(error: Error): number {
  // An explicit status on the error always wins over inference.
  const explicit = explicitStatusCode(error);
  if (explicit !== undefined) {
    return explicit;
  }

  // Check for adapter errors
  if (error instanceof ValidationError) {
    return 400;
  }

  if (error instanceof AuthenticationError) {
    return 401;
  }

  if (error instanceof RateLimitError) {
    return 429;
  }

  if (error instanceof NetworkError) {
    return 502;
  }

  if (error instanceof ProviderError) {
    return 503;
  }

  if (error instanceof StreamError) {
    return 500;
  }

  if (error instanceof AdapterError) {
    return 500;
  }

  // Check for common error patterns in message
  const message = error.message.toLowerCase();

  // `validation` joins this group rather than getting its own branch further
  // down, so that it keeps answering 400 exactly as `handler.ts` did.
  if (
    message.includes('invalid') ||
    message.includes('malformed') ||
    message.includes('validation')
  ) {
    return 400;
  }

  if (message.includes('unauthorized') || message.includes('authentication')) {
    return 401;
  }

  if (message.includes('forbidden') || message.includes('permission')) {
    return 403;
  }

  if (message.includes('not found')) {
    return 404;
  }

  // From `handler.ts`'s copy; the shared mapper had no conflict branch.
  if (message.includes('conflict')) {
    return 409;
  }

  // 504, not 408. 408 says the client was too slow; 504 says an upstream was.
  // This library proxies to a provider, so a timeout it observes is a gateway
  // timeout. `handler.ts` answered 408 for this same predicate before #105.
  if (message.includes('timeout')) {
    return 504;
  }

  if (message.includes('too large')) {
    return 413;
  }

  // Default to 500
  return 500;
}
