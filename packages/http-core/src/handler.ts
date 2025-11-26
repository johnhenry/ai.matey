/**
 * Core HTTP Handler
 *
 * Framework-agnostic HTTP request handler that can be adapted to any framework.
 * Contains all the core logic for CORS, auth, rate limiting, routing, and streaming.
 *
 * @module
 */

import type { Bridge } from 'ai.matey.core';
import type {
  GenericRequest,
  GenericResponse,
  CoreHandlerOptions,
  ParsedGenericRequest,
} from './types.js';
import { RateLimiter } from './rate-limiter.js';
import { RouteMatcher, applyPathPrefix } from './route-matcher.js';
import { normalizeCORSOptions } from './cors.js';
import { detectProviderFormat } from './response-formatter.js';

/**
 * Core HTTP request handler (framework-agnostic)
 */
export class CoreHTTPHandler {
  private readonly bridge: Bridge;
  private readonly options: Required<Omit<CoreHandlerOptions, 'validateAuth' | 'onError' | 'rateLimit' | 'routes' | 'cors'>> & {
    validateAuth?: CoreHandlerOptions['validateAuth'];
    onError?: CoreHandlerOptions['onError'];
    rateLimit?: CoreHandlerOptions['rateLimit'];
    routes?: CoreHandlerOptions['routes'];
    corsOptions: ReturnType<typeof normalizeCORSOptions>;
  };
  private readonly rateLimiter: RateLimiter | null;
  private readonly routeMatcher: RouteMatcher | null;

  constructor(options: CoreHandlerOptions) {
    this.bridge = options.bridge;

    // Normalize options
    const corsOptions = normalizeCORSOptions(options.cors);

    // Apply path prefix to routes if provided
    let routes = options.routes;
    if (routes && options.pathPrefix) {
      routes = applyPathPrefix(routes, options.pathPrefix);
    }

    this.options = {
      bridge: this.bridge,
      corsOptions,
      validateAuth: options.validateAuth,
      onError: options.onError,
      headers: options.headers || {},
      timeout: options.timeout ?? 30000,
      pathPrefix: options.pathPrefix ?? '',
      rateLimit: options.rateLimit,
      routes,
      logging: options.logging ?? false,
      log: options.log ?? console.log,
      maxBodySize: options.maxBodySize ?? 10 * 1024 * 1024, // 10MB
      streaming: options.streaming ?? true,
    };

    // Create rate limiter if configured
    // TODO: Refactor RateLimiter to use generic types
    this.rateLimiter = this.options.rateLimit ? new RateLimiter(this.options.rateLimit as any) : null;

    // Create route matcher if routes configured
    this.routeMatcher = this.options.routes ? new RouteMatcher(this.options.routes) : null;
  }

  /**
   * Dispose of the handler and release resources.
   * Call this when the handler is no longer needed to prevent memory leaks.
   */
  dispose(): void {
    if (this.rateLimiter) {
      this.rateLimiter.dispose();
    }
  }

  /**
   * Handle HTTP request
   */
  async handle(req: GenericRequest, res: GenericResponse): Promise<void> {
    try {
      // Handle CORS if enabled
      if (this.options.corsOptions) {
        const origin = req.headers.origin || req.headers['Origin'] || '';

        // Check if origin is allowed
        if (!this.isOriginAllowed(origin, this.options.corsOptions.origin)) {
          res.status(403);
          res.send({ error: 'Origin not allowed' });
          return;
        }

        // Set CORS headers
        if (typeof this.options.corsOptions.origin === 'string' && this.options.corsOptions.origin === '*') {
          res.header('Access-Control-Allow-Origin', '*');
        } else if (origin) {
          res.header('Access-Control-Allow-Origin', origin);
          res.header('Vary', 'Origin');
        }

        if (this.options.corsOptions.credentials) {
          res.header('Access-Control-Allow-Credentials', 'true');
        }

        if (this.options.corsOptions.exposedHeaders && this.options.corsOptions.exposedHeaders.length > 0) {
          res.header(
            'Access-Control-Expose-Headers',
            Array.isArray(this.options.corsOptions.exposedHeaders)
              ? this.options.corsOptions.exposedHeaders.join(', ')
              : this.options.corsOptions.exposedHeaders
          );
        }

        // Handle preflight
        const isPreflightRequest =
          req.method === 'OPTIONS' &&
          origin &&
          (req.headers['access-control-request-method'] || req.headers['Access-Control-Request-Method']);

        if (isPreflightRequest) {
          // Set preflight headers
          res.header(
            'Access-Control-Allow-Methods',
            Array.isArray(this.options.corsOptions.methods)
              ? this.options.corsOptions.methods.join(', ')
              : this.options.corsOptions.methods
          );

          const requestHeaders =
            req.headers['access-control-request-headers'] || req.headers['Access-Control-Request-Headers'];
          if (requestHeaders) {
            res.header('Access-Control-Allow-Headers', requestHeaders);
          } else if (this.options.corsOptions.allowedHeaders) {
            res.header(
              'Access-Control-Allow-Headers',
              Array.isArray(this.options.corsOptions.allowedHeaders)
                ? this.options.corsOptions.allowedHeaders.join(', ')
                : this.options.corsOptions.allowedHeaders
            );
          }

          res.header('Access-Control-Max-Age', String(this.options.corsOptions.maxAge));

          // Send successful preflight response
          res.status(204);
          res.send('');
          return;
        }
      }

      // Check rate limit
      if (this.rateLimiter && res.isWritable()) {
        // Create minimal Node.js-like request/response for rate limiter
        // TODO: Refactor rate limiter to use generic types
        const nodeReq = {
          headers: req.headers,
          socket: { remoteAddress: req.ip },
        } as any;

        const nodeRes = {
          setHeader: (name: string, value: string) => res.header(name, value),
          end: (data?: string) => {
            if (data) {
              res.send(JSON.parse(data));
            }
          },
          get statusCode() {
            return this._statusCode || 200;
          },
          set statusCode(value: number) {
            this._statusCode = value;
            res.status(value);
          },
          _statusCode: 200,
        } as any;

        const isLimited = await this.rateLimiter.check(nodeReq, nodeRes);
        if (isLimited) {
          return; // Rate limiter already sent response
        }
      }

      // Validate authentication
      if (this.options.validateAuth) {
        const isAuthenticated = await this.options.validateAuth(req);
        if (!isAuthenticated) {
          const format = detectProviderFormat(req.url || '');
          res.status(401);
          res.send(this.formatErrorResponse(new Error('Unauthorized'), 401, format));
          return;
        }
      }

      // Parse request (create explicit object instead of spread to ensure all properties are copied)
      const parsedRequest: ParsedGenericRequest = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
        params: req.params,
        query: req.query,
        ip: req.ip,
        stream: req.body?.stream === true,
      };

      // Log request if enabled
      if (this.options.logging && this.options.log) {
        this.options.log(`${parsedRequest.method} ${parsedRequest.url}`, parsedRequest.body);
      }

      // Check if request body exists for POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(parsedRequest.method) && !parsedRequest.body) {
        const format = detectProviderFormat(parsedRequest.url || '');
        res.status(400);
        res.send(this.formatErrorResponse(new Error('Request body is required'), 400, format));
        return;
      }

      // Match route if route matcher configured
      let activeBridge = this.bridge;

      if (this.routeMatcher) {
        // Create minimal Node.js-like request for route matcher
        // TODO: Refactor route matcher to use generic types
        const nodeReq = {
          url: req.url,
          method: req.method,
        } as any;

        const matchedRoute = this.routeMatcher.match(nodeReq);

        if (!matchedRoute) {
          res.status(404);
          res.send({ error: 'Route not found' });
          return;
        }

        // Use route-specific bridge if provided
        if (matchedRoute.config.bridge) {
          activeBridge = matchedRoute.config.bridge;
        }
      }

      // Apply custom headers
      if (this.options.headers) {
        for (const [key, value] of Object.entries(this.options.headers)) {
          res.header(key, value);
        }
      }

      // Handle streaming or non-streaming request
      if (this.options.streaming && parsedRequest.stream) {
        // Handle streaming request
        const stream = activeBridge.chatStream(parsedRequest.body);

        // Convert to async generator for generic response
        async function* convertStream() {
          for await (const chunk of stream) {
            yield chunk;
          }
        }

        await res.stream(convertStream());
      } else {
        // Handle non-streaming request
        const response = await activeBridge.chat(parsedRequest.body);

        // Send response
        res.status(200);
        res.send(response);
      }

      // Log response if enabled
      if (this.options.logging && this.options.log) {
        this.options.log(`${parsedRequest.method} ${parsedRequest.url} - 200 OK`);
      }
    } catch (error) {
      // Handle errors
      await this.handleError(error as Error, req, res);
    }
  }

  /**
   * Handle errors
   */
  private async handleError(error: Error, req: GenericRequest, res: GenericResponse): Promise<void> {
    // Log error if enabled
    if (this.options.logging && this.options.log) {
      this.options.log(`Error: ${req.method} ${req.url}`, error);
    }

    // Call error handler
    if (this.options.onError) {
      await this.options.onError(error, req, res);
    } else {
      // Use built-in error formatting
      const format = detectProviderFormat(req.url || '');
      const statusCode = this.getErrorStatusCode(error);

      res.status(statusCode);
      res.send(this.formatErrorResponse(error, statusCode, format));
    }
  }

  /**
   * Check if origin is allowed
   */
  private isOriginAllowed(
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
   * Get HTTP status code from error
   */
  private getErrorStatusCode(error: Error): number {
    // Check for common error patterns
    const message = error.message.toLowerCase();

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
      return 408;
    }

    if (message.includes('conflict')) {
      return 409;
    }

    if (message.includes('validation') || message.includes('invalid')) {
      return 400;
    }

    // Default to 500 for unknown errors
    return 500;
  }

  /**
   * Format error response in provider-specific format
   */
  private formatErrorResponse(
    error: Error,
    statusCode: number,
    format: 'openai' | 'anthropic' | 'generic'
  ): any {
    if (format === 'openai') {
      return {
        error: {
          message: error.message,
          type: 'server_error',
          code: statusCode >= 500 ? 'internal_server_error' : 'invalid_request_error',
        },
      };
    }

    if (format === 'anthropic') {
      return {
        type: 'error',
        error: {
          type: statusCode >= 500 ? 'api_error' : 'invalid_request_error',
          message: error.message,
        },
      };
    }

    // Generic format
    return {
      error: error.message,
      statusCode,
    };
  }
}
