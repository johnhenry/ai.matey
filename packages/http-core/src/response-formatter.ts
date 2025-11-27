/**
 * HTTP Response Formatter
 *
 * Formats responses for HTTP responses with proper headers and status codes.
 *
 * @module
 */

import type { ServerResponse } from 'http';

/**
 * Send JSON response
 */
export function sendJSON(
  res: ServerResponse,
  data: any,
  statusCode: number = 200,
  headers: Record<string, string> = {}
): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');

  // Set custom headers
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }

  const body = JSON.stringify(data);
  res.end(body);
}

/**
 * Send error response
 */
export function sendError(
  res: ServerResponse,
  error: Error,
  statusCode: number = 500,
  format: 'openai' | 'anthropic' | 'generic' = 'generic'
): void {
  let errorBody: any;

  switch (format) {
    case 'openai':
      errorBody = formatOpenAIError(error, statusCode);
      break;
    case 'anthropic':
      errorBody = formatAnthropicError(error, statusCode);
      break;
    default:
      errorBody = formatGenericError(error, statusCode);
      break;
  }

  sendJSON(res, errorBody, statusCode);
}

/**
 * Format error in OpenAI style
 */
function formatOpenAIError(error: Error, statusCode: number): any {
  return {
    error: {
      message: error.message,
      type: getOpenAIErrorType(statusCode),
      code: statusCode === 429 ? 'rate_limit_exceeded' : null,
    },
  };
}

/**
 * Format error in Anthropic style
 */
function formatAnthropicError(error: Error, statusCode: number): any {
  return {
    type: 'error',
    error: {
      type: getAnthropicErrorType(statusCode),
      message: error.message,
    },
  };
}

/**
 * Format error in generic style
 */
function formatGenericError(error: Error, statusCode: number): any {
  return {
    error: {
      message: error.message,
      status: statusCode,
    },
  };
}

/**
 * Get OpenAI error type from status code
 */
function getOpenAIErrorType(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'invalid_request_error';
    case 401:
      return 'authentication_error';
    case 403:
      return 'permission_error';
    case 404:
      return 'not_found_error';
    case 429:
      return 'rate_limit_error';
    case 500:
      return 'server_error';
    case 503:
      return 'service_unavailable_error';
    default:
      return 'api_error';
  }
}

/**
 * Get Anthropic error type from status code
 */
function getAnthropicErrorType(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'invalid_request_error';
    case 401:
      return 'authentication_error';
    case 403:
      return 'permission_error';
    case 404:
      return 'not_found_error';
    case 429:
      return 'rate_limit_error';
    case 500:
      return 'api_error';
    case 529:
      return 'overloaded_error';
    default:
      return 'api_error';
  }
}

/**
 * Send Server-Sent Events (SSE) headers
 */
export function sendSSEHeaders(res: ServerResponse, headers: Record<string, string> = {}): void {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Set custom headers
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }

  // Write headers (flushes them to client)
  res.flushHeaders?.();
}

/**
 * Send SSE data chunk
 */
export function sendSSEChunk(res: ServerResponse, data: any): void {
  const json = JSON.stringify(data);
  res.write(`data: ${json}\n\n`);
}

/**
 * Send SSE event with custom event type
 */
export function sendSSEEvent(res: ServerResponse, event: string, data: any): void {
  const json = JSON.stringify(data);
  res.write(`event: ${event}\ndata: ${json}\n\n`);
}

/**
 * Send SSE done marker
 */
export function sendSSEDone(res: ServerResponse): void {
  res.write('data: [DONE]\n\n');
  res.end();
}

/**
 * Send SSE error
 */
export function sendSSEError(
  res: ServerResponse,
  error: Error,
  format: 'openai' | 'anthropic' | 'generic' = 'generic'
): void {
  let errorData: any;

  switch (format) {
    case 'openai':
      errorData = formatOpenAIError(error, 500);
      break;
    case 'anthropic':
      errorData = formatAnthropicError(error, 500);
      break;
    default:
      errorData = formatGenericError(error, 500);
      break;
  }

  sendSSEChunk(res, errorData);
  res.end();
}

/**
 * Send plain text response
 */
export function sendText(
  res: ServerResponse,
  text: string,
  statusCode: number = 200,
  headers: Record<string, string> = {}
): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/plain');

  // Set custom headers
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }

  res.end(text);
}

/**
 * Send 204 No Content response
 */
export function sendNoContent(res: ServerResponse): void {
  res.statusCode = 204;
  res.end();
}

/**
 * Detect provider format from request path or headers
 */
export function detectProviderFormat(path: string): 'openai' | 'anthropic' | 'generic' {
  if (path.includes('/chat/completions')) {
    return 'openai';
  }

  if (path.includes('/messages')) {
    return 'anthropic';
  }

  return 'generic';
}
