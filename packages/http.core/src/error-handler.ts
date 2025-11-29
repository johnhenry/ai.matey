/**
 * Error Handler
 *
 * Handles errors in HTTP requests and formats appropriate responses.
 *
 * @module
 */

import type { IncomingMessage, ServerResponse } from 'http';
import type { ErrorHandler } from './types.js';
import { sendError, detectProviderFormat } from './response-formatter.js';
import {
  AdapterError,
  ValidationError,
  AuthenticationError,
  RateLimitError,
  NetworkError,
  ProviderError,
  StreamError,
} from 'ai.matey.errors';

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
 * Get HTTP status code from error
 */
function getHTTPStatusCode(error: Error): number {
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

  if (message.includes('invalid') || message.includes('malformed')) {
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

  if (message.includes('timeout')) {
    return 504;
  }

  if (message.includes('too large')) {
    return 413;
  }

  // Default to 500
  return 500;
}

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
