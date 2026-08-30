/**
 * HTTP Request Parser
 *
 * Parses incoming HTTP requests into a standardized format for processing.
 *
 * @module
 */

import type { IncomingMessage } from 'node:http';
import type { ParsedRequest } from './types.js';
import { AdapterError, ValidationError } from '@johnhenry/aimatey-errors';
import { ErrorCode } from '@johnhenry/aimatey-types';

const PARSER_PROVENANCE = { middleware: 'http-request-parser' } as const;

/**
 * A malformed request is the client's fault, not ours.
 *
 * Raising a typed `ValidationError` rather than a bare `Error` is what lets
 * `getHTTPStatusCode()` answer 400 instead of falling through to 500 -- the
 * difference between telling a caller their payload is broken and telling them
 * our server is.
 */
function invalidRequest(message: string): ValidationError {
  return new ValidationError({
    code: ErrorCode.INVALID_REQUEST,
    message,
    validationDetails: [],
    provenance: PARSER_PROVENANCE,
  });
}

/**
 * Body-too-large needs 413 specifically, which no error *class* encodes, so the
 * status is declared explicitly on the error rather than inferred from the word
 * "large" appearing in its message.
 */
function payloadTooLarge(maxSize: number): AdapterError {
  return new AdapterError({
    code: ErrorCode.INVALID_REQUEST,
    message: `Request body too large (max ${maxSize} bytes)`,
    isRetryable: false,
    provenance: PARSER_PROVENANCE,
    details: { httpStatus: 413, maxBodySize: maxSize },
  });
}

/**
 * Parse incoming HTTP request
 */
export async function parseRequest(
  req: IncomingMessage,
  maxBodySize: number = 10 * 1024 * 1024 // 10MB default
): Promise<ParsedRequest> {
  // Parse URL. A garbage request line or Host header makes `new URL` throw a
  // bare TypeError, which would otherwise be reported to the client as a 500
  // even though the request they sent is what was wrong.
  let url: URL;
  try {
    url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  } catch {
    throw invalidRequest('Invalid request URL or Host header');
  }

  const path = url.pathname;
  const method = req.method?.toUpperCase() || 'GET';

  // Parse query parameters
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  // Normalize headers
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') {
      headers[key.toLowerCase()] = value;
    } else if (Array.isArray(value)) {
      headers[key.toLowerCase()] = value[0] || '';
    }
  }

  // Parse body (if present)
  let body: any = null;
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    const rawBody = await readBody(req, maxBodySize);

    if (rawBody) {
      const contentType = headers['content-type'] || '';

      if (contentType.includes('application/json')) {
        try {
          body = JSON.parse(rawBody);
        } catch (error) {
          throw invalidRequest(
            `Invalid JSON body: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        body = parseFormData(rawBody);
      } else {
        // Unknown content type, try JSON anyway
        try {
          body = JSON.parse(rawBody);
        } catch {
          body = rawBody;
        }
      }
    }
  }

  // Detect streaming request
  const stream = body?.stream === true || headers['accept'] === 'text/event-stream';

  return {
    body,
    headers,
    path,
    method,
    query,
    stream,
  };
}

/**
 * Read request body as string
 */
function readBody(req: IncomingMessage, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;
    // Once the limit is hit we stop buffering, but keep draining. Destroying
    // the request here would tear down the socket the response has to go out
    // on, so the client would get no 413 at all -- just a closed connection.
    let overLimit = false;

    req.on('data', (chunk: Buffer) => {
      if (overLimit) {
        // Drain and discard: bounded memory, socket still writable.
        return;
      }

      totalSize += chunk.length;

      if (totalSize > maxSize) {
        overLimit = true;
        chunks.length = 0;
        reject(payloadTooLarge(maxSize));
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf-8');
      resolve(body);
    });

    req.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Parse form-encoded data
 */
function parseFormData(data: string): Record<string, string> {
  const params = new URLSearchParams(data);
  const result: Record<string, string> = {};

  params.forEach((value, key) => {
    result[key] = value;
  });

  return result;
}

/**
 * Extract bearer token from Authorization header
 */
export function extractBearerToken(req: IncomingMessage): string | null {
  const auth = req.headers.authorization;

  if (!auth) {
    return null;
  }

  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] || null : null;
}

/**
 * Get client IP address from request
 */
export function getClientIP(req: IncomingMessage): string {
  // Check common proxy headers
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = typeof forwarded === 'string' ? forwarded.split(',') : forwarded;
    return ips[0]?.trim() || 'unknown';
  }

  const realIP = req.headers['x-real-ip'];
  if (realIP && typeof realIP === 'string') {
    return realIP;
  }

  // Fallback to socket address
  return req.socket.remoteAddress || 'unknown';
}
