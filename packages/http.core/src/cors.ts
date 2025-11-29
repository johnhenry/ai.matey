/**
 * CORS Handler
 *
 * Handles Cross-Origin Resource Sharing (CORS) for HTTP requests.
 *
 * @module
 */

import type { IncomingMessage, ServerResponse } from 'http';
import type { CORSOptions } from './types.js';

/**
 * Default CORS options
 */
const DEFAULT_CORS_OPTIONS: Required<CORSOptions> = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: [],
  credentials: true,
  maxAge: 86400, // 24 hours
};

/**
 * Normalize CORS options
 */
export function normalizeCORSOptions(
  options: boolean | CORSOptions | undefined
): Required<CORSOptions> | null {
  if (options === false) {
    return null;
  }

  if (options === true || options === undefined) {
    return DEFAULT_CORS_OPTIONS;
  }

  return {
    origin: options.origin ?? DEFAULT_CORS_OPTIONS.origin,
    methods: options.methods ?? DEFAULT_CORS_OPTIONS.methods,
    allowedHeaders: options.allowedHeaders ?? DEFAULT_CORS_OPTIONS.allowedHeaders,
    exposedHeaders: options.exposedHeaders ?? DEFAULT_CORS_OPTIONS.exposedHeaders,
    credentials: options.credentials ?? DEFAULT_CORS_OPTIONS.credentials,
    maxAge: options.maxAge ?? DEFAULT_CORS_OPTIONS.maxAge,
  };
}

/**
 * Handle CORS headers
 */
export function handleCORS(
  req: IncomingMessage,
  res: ServerResponse,
  options: Required<CORSOptions>
): boolean {
  const origin = req.headers.origin || '';

  // Check if origin is allowed
  if (!isOriginAllowed(origin, options.origin)) {
    return false;
  }

  // Set Access-Control-Allow-Origin
  if (typeof options.origin === 'string' && options.origin === '*') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  // Set Access-Control-Allow-Credentials
  if (options.credentials) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Set Access-Control-Expose-Headers
  if (options.exposedHeaders.length > 0) {
    res.setHeader(
      'Access-Control-Expose-Headers',
      Array.isArray(options.exposedHeaders)
        ? options.exposedHeaders.join(', ')
        : options.exposedHeaders
    );
  }

  return true;
}

/**
 * Handle CORS preflight (OPTIONS) request
 */
export function handlePreflight(
  req: IncomingMessage,
  res: ServerResponse,
  options: Required<CORSOptions>
): void {
  const origin = req.headers.origin || '';

  // Check if origin is allowed
  if (!isOriginAllowed(origin, options.origin)) {
    res.statusCode = 403;
    res.end('Origin not allowed');
    return;
  }

  // Set Access-Control-Allow-Origin
  if (typeof options.origin === 'string' && options.origin === '*') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  // Set Access-Control-Allow-Methods
  res.setHeader(
    'Access-Control-Allow-Methods',
    Array.isArray(options.methods) ? options.methods.join(', ') : options.methods
  );

  // Set Access-Control-Allow-Headers
  const requestHeaders = req.headers['access-control-request-headers'];
  if (requestHeaders) {
    res.setHeader('Access-Control-Allow-Headers', requestHeaders);
  } else {
    res.setHeader(
      'Access-Control-Allow-Headers',
      Array.isArray(options.allowedHeaders)
        ? options.allowedHeaders.join(', ')
        : options.allowedHeaders
    );
  }

  // Set Access-Control-Allow-Credentials
  if (options.credentials) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Set Access-Control-Max-Age
  res.setHeader('Access-Control-Max-Age', String(options.maxAge));

  // Send successful preflight response
  res.statusCode = 204;
  res.end();
}

/**
 * Check if origin is allowed
 */
function isOriginAllowed(
  origin: string,
  allowedOrigin: string | string[] | ((origin: string) => boolean)
): boolean {
  if (!origin) {
    return true; // Allow requests without origin header
  }

  if (typeof allowedOrigin === 'string') {
    return allowedOrigin === '*' || allowedOrigin === origin;
  }

  if (Array.isArray(allowedOrigin)) {
    return allowedOrigin.includes(origin) || allowedOrigin.includes('*');
  }

  if (typeof allowedOrigin === 'function') {
    return allowedOrigin(origin);
  }

  return false;
}

/**
 * Check if request is a CORS preflight request
 */
export function isPreflight(req: IncomingMessage): boolean {
  return (
    req.method === 'OPTIONS' &&
    !!req.headers.origin &&
    !!req.headers['access-control-request-method']
  );
}
