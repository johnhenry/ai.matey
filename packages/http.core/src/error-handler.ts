/**
 * Error Handler
 *
 * Handles errors in HTTP requests and formats appropriate responses.
 *
 * @module
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ErrorHandler } from './types.js';
import { sendError, detectProviderFormat } from './response-formatter.js';
import { getHTTPStatusCode } from './status-mapping.js';
import { AdapterError, NetworkError, ProviderError } from '@johnhenry/aimatey-errors';

/**
 * Default error handler
 */
export const defaultErrorHandler: ErrorHandler = (
  error: Error,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> => {
  // Detect provider format from request
  const format = detectProviderFormat(req.url || '');

  // Map error to HTTP status code
  const statusCode = getHTTPStatusCode(error);

  // Log error (in production, this should go to a proper logger)
  if (statusCode >= 500) {
    console.error('HTTP Server Error:', error);
  }

  // Send error response
  sendError(res, error, statusCode, format);
  return Promise.resolve();
};

/**
 * Re-exported from `./status-mapping.js`, which holds the single
 * implementation now shared with `handler.ts` (#105). Still exported from here
 * so the package's public entry point (`index.ts`) is unchanged.
 */
export { getHTTPStatusCode } from './status-mapping.js';

/**
 * Create error handler that logs to a custom logger
 */
export function createLoggingErrorHandler(
  log: (message: string, error: Error) => void
): ErrorHandler {
  return async (error: Error, req: IncomingMessage, res: ServerResponse): Promise<void> => {
    log(`HTTP Error: ${req.method} ${req.url}`, error);
    await defaultErrorHandler(error, req, res);
  };
}

/**
 * Create error handler that reports errors to an external service
 */
export function createReportingErrorHandler(
  reporter: (error: Error, req: IncomingMessage) => Promise<void>
): ErrorHandler {
  return async (error: Error, req: IncomingMessage, res: ServerResponse): Promise<void> => {
    // Report error asynchronously (don't wait)
    reporter(error, req).catch((reportError) => {
      console.error('Error reporting failed:', reportError);
    });

    // Send response
    await defaultErrorHandler(error, req, res);
  };
}

/**
 * Wrap error handler with custom logic
 */
export function wrapErrorHandler(
  baseHandler: ErrorHandler,
  wrapper: (
    error: Error,
    req: IncomingMessage,
    res: ServerResponse,
    next: () => Promise<void>
  ) => Promise<void>
): ErrorHandler {
  return async (error: Error, req: IncomingMessage, res: ServerResponse): Promise<void> => {
    await wrapper(error, req, res, async () => {
      await baseHandler(error, req, res);
    });
  };
}

/**
 * Check if error should be retried
 */
export function isRetryableError(error: Error): boolean {
  if (error instanceof AdapterError) {
    return error.isRetryable;
  }

  if (error instanceof NetworkError || error instanceof ProviderError) {
    return true;
  }

  // Check for timeout errors by message
  if (error.message.toLowerCase().includes('timeout')) {
    return true;
  }

  return false;
}

/**
 * Check if error is a client error (4xx)
 */
export function isClientError(error: Error): boolean {
  const statusCode = getHTTPStatusCode(error);
  return statusCode >= 400 && statusCode < 500;
}

/**
 * Check if error is a server error (5xx)
 */
export function isServerError(error: Error): boolean {
  const statusCode = getHTTPStatusCode(error);
  return statusCode >= 500;
}
