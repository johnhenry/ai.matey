/**
 * Rate Limiter
 *
 * Implements rate limiting for HTTP requests using a sliding window algorithm.
 *
 * @module
 */

import type { IncomingMessage, ServerResponse } from 'http';
import type {
  GenericRateLimitOptions,
  GenericRequest,
  GenericResponse,
  RateLimitOptions,
  RateLimitState,
} from './types.js';
import { getClientIP } from './request-parser.js';
import { sendJSON } from './response-formatter.js';

/**
 * Framework-agnostic rate limiter operating on GenericRequest/GenericResponse.
 *
 * Used by CoreHTTPHandler so every framework adapter (Express, Fastify, Hono,
 * Koa, Node, Deno) shares one implementation without Node-specific shims.
 */
export class GenericRateLimiter {
  private readonly options: Required<GenericRateLimitOptions>;
  private readonly store: Map<string, RateLimitState>;
  private cleanupIntervalId: ReturnType<typeof setInterval> | undefined;

  constructor(options: GenericRateLimitOptions) {
    this.options = {
      max: options.max,
      windowMs: options.windowMs ?? 60000,
      keyGenerator: options.keyGenerator ?? ((req: GenericRequest) => req.ip ?? 'unknown'),
      handler: options.handler ?? defaultGenericRateLimitHandler,
      skip: options.skip ?? (() => false),
      headers: options.headers ?? true,
    };
    this.store = new Map();
    this.cleanupIntervalId = setInterval(() => this.cleanup(), this.options.windowMs);
  }

  /**
   * Check if a request should be rate limited.
   *
   * @returns true when the request was rejected (response already sent)
   */
  async check(req: GenericRequest, res: GenericResponse): Promise<boolean> {
    if (await this.options.skip(req)) {
      return false;
    }

    const key = this.options.keyGenerator(req);
    const now = Date.now();

    let state = this.store.get(key);
    if (!state || now >= state.resetTime) {
      state = { count: 0, resetTime: now + this.options.windowMs };
      this.store.set(key, state);
    }
    state.count++;

    if (this.options.headers) {
      res.header('X-RateLimit-Limit', String(this.options.max));
      res.header('X-RateLimit-Remaining', String(Math.max(0, this.options.max - state.count)));
      res.header('X-RateLimit-Reset', String(Math.ceil(state.resetTime / 1000)));
    }

    if (state.count > this.options.max) {
      const retryAfter = Math.ceil((state.resetTime - now) / 1000);

      if (this.options.headers) {
        res.header('Retry-After', String(retryAfter));
      }

      await this.options.handler(req, res, retryAfter);
      return true;
    }

    return false;
  }

  /**
   * Reset rate limit for a specific key.
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Reset all rate limits.
   */
  resetAll(): void {
    this.store.clear();
  }

  /**
   * Get current state for a key.
   */
  getState(key: string): RateLimitState | undefined {
    return this.store.get(key);
  }

  /**
   * Dispose of the rate limiter and clean up resources.
   */
  dispose(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = undefined;
    }
    this.store.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, state] of this.store.entries()) {
      if (now >= state.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

/**
 * Default rate limit handler for the generic limiter.
 */
function defaultGenericRateLimitHandler(
  _req: GenericRequest,
  res: GenericResponse,
  retryAfter: number
): void {
  res.status(429);
  res.send({
    error: {
      message: 'Too many requests, please try again later.',
      type: 'rate_limit_exceeded',
      retryAfter,
    },
  });
}

/**
 * Rate limiter class
 */
export class RateLimiter {
  private readonly options: Required<RateLimitOptions>;
  private readonly store: Map<string, RateLimitState>;
  private cleanupIntervalId: ReturnType<typeof setInterval> | undefined;

  constructor(options: RateLimitOptions) {
    this.options = {
      max: options.max,
      windowMs: options.windowMs ?? 60000, // 1 minute default
      keyGenerator: options.keyGenerator ?? defaultKeyGenerator,
      handler: options.handler ?? defaultRateLimitHandler,
      skip: options.skip ?? (() => false),
      headers: options.headers ?? true,
    };

    this.store = new Map();

    // Cleanup old entries periodically
    this.cleanupIntervalId = setInterval(() => this.cleanup(), this.options.windowMs);
  }

  /**
   * Dispose of the rate limiter and clean up resources.
   * Call this when the rate limiter is no longer needed to prevent memory leaks.
   */
  dispose(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = undefined;
    }
    this.store.clear();
  }

  /**
   * Check if request should be rate limited
   */
  async check(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    // Check if rate limiting should be skipped
    if (await this.options.skip(req)) {
      return false;
    }

    const key = this.options.keyGenerator(req);
    const now = Date.now();

    // Get or create state for this key
    let state = this.store.get(key);

    if (!state || now >= state.resetTime) {
      // Create new window
      state = {
        count: 0,
        resetTime: now + this.options.windowMs,
      };
      this.store.set(key, state);
    }

    // Increment request count
    state.count++;

    // Add rate limit headers
    if (this.options.headers) {
      res.setHeader('X-RateLimit-Limit', String(this.options.max));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, this.options.max - state.count)));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(state.resetTime / 1000)));
    }

    // Check if limit exceeded
    if (state.count > this.options.max) {
      const retryAfter = Math.ceil((state.resetTime - now) / 1000);

      if (this.options.headers) {
        res.setHeader('Retry-After', String(retryAfter));
      }

      // Call custom handler
      await this.options.handler(req, res, retryAfter);

      return true; // Rate limited
    }

    return false; // Not rate limited
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();

    for (const [key, state] of this.store.entries()) {
      if (now >= state.resetTime) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Reset rate limit for a specific key
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this.store.clear();
  }

  /**
   * Get current state for a key
   */
  getState(key: string): RateLimitState | undefined {
    return this.store.get(key);
  }
}

/**
 * Default key generator (uses IP address)
 */
function defaultKeyGenerator(req: IncomingMessage): string {
  return getClientIP(req);
}

/**
 * Default rate limit handler
 */
function defaultRateLimitHandler(
  _req: IncomingMessage,
  res: ServerResponse,
  retryAfter: number
): void {
  sendJSON(
    res,
    {
      error: {
        message: 'Too many requests, please try again later.',
        type: 'rate_limit_exceeded',
        retryAfter,
      },
    },
    429
  );
}

/**
 * Create key generator from user ID in request body
 */
export function userIDKeyGenerator(req: IncomingMessage): string {
  // This would need to be called after body parsing
  // For now, fall back to IP
  return getClientIP(req);
}

/**
 * Create key generator from authorization token
 */
export function tokenKeyGenerator(req: IncomingMessage): string {
  const auth = req.headers.authorization;

  if (auth) {
    return auth;
  }

  return getClientIP(req);
}

/**
 * Create key generator that combines multiple factors
 */
export function combineKeyGenerators(
  ...generators: ((req: IncomingMessage) => string)[]
): (req: IncomingMessage) => string {
  return (req: IncomingMessage): string => {
    const parts = generators.map((gen) => gen(req));
    return parts.join(':');
  };
}
