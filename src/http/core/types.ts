/**
 * Core HTTP Types
 *
 * Framework-agnostic type definitions for the HTTP adapter system.
 * These types allow us to write core logic once and adapt it to any framework.
 *
 * @module
 */

import type { Bridge } from '../../core/bridge.js';
import type { CORSOptions, RouteConfig } from '../types.js';

// ============================================================================
// Generic Request/Response Interfaces
// ============================================================================

/**
 * Generic HTTP request interface (framework-agnostic)
 */
export interface GenericRequest {
  /**
   * HTTP method (GET, POST, etc.)
   */
  method: string;

  /**
   * Full request URL
   */
  url: string;

  /**
   * Request headers (normalized to lowercase keys)
   */
  headers: Record<string, string>;

  /**
   * Parsed request body (null if not yet parsed)
   */
  body: any;

  /**
   * URL parameters (e.g., /users/:id -> { id: '123' })
   */
  params?: Record<string, string>;

  /**
   * Query string parameters
   */
  query?: Record<string, string>;

  /**
   * Client IP address
   */
  ip?: string;
}

/**
 * Generic HTTP response interface (framework-agnostic)
 */
export interface GenericResponse {
  /**
   * Set HTTP status code
   */
  status(code: number): void;

  /**
   * Set response header
   */
  header(name: string, value: string): void;

  /**
   * Send JSON response
   */
  send(data: any): void;

  /**
   * Send streaming response (SSE)
   */
  stream(generator: AsyncGenerator<any, void, undefined>): Promise<void>;

  /**
   * Check if response is writable
   */
  isWritable(): boolean;
}

// ============================================================================
// Core Handler Types
// ============================================================================

/**
 * Auth validator for generic requests
 */
export type GenericAuthValidator = (req: GenericRequest) => boolean | Promise<boolean>;

/**
 * Error handler for generic requests/responses
 */
export type GenericErrorHandler = (
  error: Error,
  req: GenericRequest,
  res: GenericResponse
) => void | Promise<void>;

/**
 * Rate limit key generator for generic requests
 */
export type GenericRateLimitKeyGenerator = (req: GenericRequest) => string;

/**
 * Rate limit handler for generic requests/responses
 */
export type GenericRateLimitHandler = (
  req: GenericRequest,
  res: GenericResponse,
  retryAfter: number
) => void | Promise<void>;

/**
 * Generic rate limit options
 */
export interface GenericRateLimitOptions {
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
  keyGenerator?: GenericRateLimitKeyGenerator;

  /**
   * Handler called when rate limit exceeded
   */
  handler?: GenericRateLimitHandler;

  /**
   * Skip rate limiting for certain requests
   */
  skip?: (req: GenericRequest) => boolean | Promise<boolean>;

  /**
   * Custom headers to include in rate limit responses
   */
  headers?: boolean;
}

/**
 * Core handler options
 */
export interface CoreHandlerOptions {
  /**
   * Bridge instance connecting frontend and backend adapters
   */
  bridge: Bridge;

  /**
   * CORS configuration
   */
  cors?: CORSOptions;

  /**
   * Authentication validator
   */
  validateAuth?: GenericAuthValidator;

  /**
   * Error handler
   */
  onError?: GenericErrorHandler;

  /**
   * Custom response headers
   */
  headers?: Record<string, string>;

  /**
   * Request timeout in milliseconds
   */
  timeout?: number;

  /**
   * Path prefix for all routes
   */
  pathPrefix?: string;

  /**
   * Rate limiting configuration
   */
  rateLimit?: GenericRateLimitOptions;

  /**
   * Route configurations for multi-endpoint support
   */
  routes?: RouteConfig[];

  /**
   * Enable request/response logging
   */
  logging?: boolean;

  /**
   * Log function
   */
  log?: (message: string, ...args: any[]) => void;

  /**
   * Maximum request body size in bytes
   */
  maxBodySize?: number;

  /**
   * Enable streaming support
   */
  streaming?: boolean;
}

// ============================================================================
// Parsed Request
// ============================================================================

/**
 * Parsed HTTP request (after body parsing)
 */
export interface ParsedGenericRequest extends GenericRequest {
  /**
   * Parsed request body (guaranteed to be parsed)
   */
  body: any;

  /**
   * Whether streaming is requested
   */
  stream?: boolean;
}
