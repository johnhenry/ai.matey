/**
 * HTTP Listener Types
 *
 * Type definitions for the HTTP listener system that allows the Universal AI Adapter
 * to handle incoming HTTP requests from various AI provider SDKs/clients.
 *
 * @module
 */

import type { IncomingMessage, ServerResponse } from 'http';
import type { Bridge } from '../core/bridge.js';
import type { FrontendAdapter } from '../types/adapters.js';

// ============================================================================
// Core Types (Generic - Framework Agnostic)
// ============================================================================
// NOTE: These are re-exported from core/types.ts for convenience
export type {
  GenericRequest,
  GenericResponse,
  GenericAuthValidator,
  GenericErrorHandler,
  GenericRateLimitKeyGenerator,
  GenericRateLimitHandler,
  GenericRateLimitOptions,
} from './core/types.js';

// ============================================================================
// Node.js-Specific Types (Backward Compatibility)
// ============================================================================

/**
 * HTTP request handler compatible with Node.js http.createServer
 */
export type HTTPRequestHandler = (
  req: IncomingMessage,
  res: ServerResponse
) => Promise<void>;

/**
 * Auth validator function (Node.js-specific)
 * @deprecated Use GenericAuthValidator for framework-agnostic code
 */
export type AuthValidator = (
  req: IncomingMessage
) => boolean | Promise<boolean>;

/**
 * Error handler function (Node.js-specific)
 * @deprecated Use GenericErrorHandler for framework-agnostic code
 */
export type ErrorHandler = (
  error: Error,
  req: IncomingMessage,
  res: ServerResponse
) => void | Promise<void>;

/**
 * Rate limit key generator (Node.js-specific)
 * @deprecated Use GenericRateLimitKeyGenerator for framework-agnostic code
 */
export type RateLimitKeyGenerator = (req: IncomingMessage) => string;

/**
 * Rate limit handler (called when limit exceeded) (Node.js-specific)
 * @deprecated Use GenericRateLimitHandler for framework-agnostic code
 */
export type RateLimitHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  retryAfter: number
) => void | Promise<void>;

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * CORS configuration options
 */
export interface CORSOptions {
  /**
   * Allowed origins (default: '*')
   */
  origin?: string | string[] | ((origin: string) => boolean);

  /**
   * Allowed HTTP methods (default: 'GET, POST, OPTIONS')
   */
  methods?: string | string[];

  /**
   * Allowed headers (default: 'Content-Type, Authorization')
   */
  allowedHeaders?: string | string[];

  /**
   * Exposed headers
   */
  exposedHeaders?: string | string[];

  /**
   * Allow credentials (default: true)
   */
  credentials?: boolean;

  /**
   * Max age for preflight cache in seconds (default: 86400)
   */
  maxAge?: number;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitOptions {
  /**
   * Maximum number of requests per window
   */
  max: number;

  /**
   * Time window in milliseconds (default: 60000 = 1 minute)
   */
  windowMs?: number;

  /**
   * Generate rate limit key from request (default: IP address)
   */
  keyGenerator?: RateLimitKeyGenerator;

  /**
   * Handler called when rate limit exceeded
   */
  handler?: RateLimitHandler;

  /**
   * Skip rate limiting for certain requests
   */
  skip?: (req: IncomingMessage) => boolean | Promise<boolean>;

  /**
   * Custom headers to include in rate limit responses
   */
  headers?: boolean;
}

/**
 * Route matching configuration
 */
export interface RouteConfig {
  /**
   * Path pattern to match (supports simple wildcards)
   * Examples: '/v1/chat/completions', '/v1/messages', '/v1/*'
   */
  path: string;

  /**
   * HTTP methods to match (default: ['POST'])
   */
  methods?: string[];

  /**
   * Frontend adapter to use for this route
   */
  frontend: FrontendAdapter;

  /**
   * Optional bridge to use (overrides default)
   */
  bridge?: Bridge;
}

/**
 * HTTP listener configuration options
 * Supports both Node.js-specific and generic types for framework compatibility
 */
export interface HTTPListenerOptions {
  /**
   * CORS configuration (default: enabled with sensible defaults)
   */
  cors?: boolean | CORSOptions;

  /**
   * Authentication validator (accepts both Node.js and generic types)
   */
  validateAuth?: AuthValidator | import('./core/types.js').GenericAuthValidator;

  /**
   * Error handler (accepts both Node.js and generic types)
   */
  onError?: ErrorHandler | import('./core/types.js').GenericErrorHandler;

  /**
   * Custom response headers
   */
  headers?: Record<string, string>;

  /**
   * Request timeout in milliseconds (default: 30000)
   */
  timeout?: number;

  /**
   * Path prefix for all routes (e.g., '/v1')
   */
  pathPrefix?: string;

  /**
   * Rate limiting configuration (accepts both Node.js and generic types)
   */
  rateLimit?: RateLimitOptions | import('./core/types.js').GenericRateLimitOptions;

  /**
   * Route configurations for multi-endpoint support
   */
  routes?: RouteConfig[];

  /**
   * Enable request/response logging (default: false)
   */
  logging?: boolean;

  /**
   * Log function (default: console.log)
   */
  log?: (message: string, ...args: any[]) => void;

  /**
   * Maximum request body size in bytes (default: 10MB)
   */
  maxBodySize?: number;

  /**
   * Enable streaming support (default: true)
   */
  streaming?: boolean;
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Parsed HTTP request
 */
export interface ParsedRequest {
  /**
   * Request body (parsed JSON)
   */
  body: any;

  /**
   * Request headers
   */
  headers: Record<string, string>;

  /**
   * Request path (without query string)
   */
  path: string;

  /**
   * HTTP method
   */
  method: string;

  /**
   * Query parameters
   */
  query: Record<string, string>;

  /**
   * Whether streaming is requested
   */
  stream?: boolean;
}

/**
 * Rate limit state
 */
export interface RateLimitState {
  /**
   * Number of requests in current window
   */
  count: number;

  /**
   * Window start timestamp
   */
  resetTime: number;
}

/**
 * Matched route information
 */
export interface MatchedRoute {
  /**
   * Route configuration
   */
  config: RouteConfig;

  /**
   * Path parameters (if any)
   */
  params: Record<string, string>;
}
