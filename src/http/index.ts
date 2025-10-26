/**
 * HTTP Listener Module
 *
 * HTTP server utilities for the Universal AI Adapter System.
 * Allows creating HTTP endpoints that accept requests in various AI provider formats
 * and route them through the universal adapter system.
 *
 * ## Framework Adapters
 *
 * This package supports multiple HTTP frameworks:
 *
 * - **Node.js**: `import { NodeHTTPListener } from 'ai.matey/http/node'`
 * - **Express**: `import { ExpressMiddleware } from 'ai.matey/http/express'`
 * - **Koa**: `import { KoaMiddleware } from 'ai.matey/http/koa'`
 * - **Hono**: `import { HonoMiddleware } from 'ai.matey/http/hono'`
 * - **Fastify**: `import { FastifyHandler } from 'ai.matey/http/fastify'`
 * - **Deno**: `import { DenoHandler } from 'ai.matey/http/deno'`
 *
 * @example Node.js
 * ```typescript
 * import http from 'http';
 * import { NodeHTTPListener } from 'ai.matey/http/node';
 * import { Bridge, OpenAIFrontendAdapter, AnthropicBackendAdapter } from 'ai.matey';
 *
 * const frontend = new OpenAIFrontendAdapter();
 * const backend = new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY });
 * const bridge = new Bridge(frontend, backend);
 *
 * const listener = NodeHTTPListener(bridge, {
 *   cors: true,
 *   streaming: true,
 * });
 *
 * const server = http.createServer(listener);
 * server.listen(8080);
 * ```
 *
 * @example Express
 * ```typescript
 * import express from 'express';
 * import { ExpressMiddleware } from 'ai.matey/http/express';
 *
 * const app = express();
 * app.use(express.json());
 * app.use('/v1/messages', ExpressMiddleware(bridge, { cors: true }));
 * app.listen(8080);
 * ```
 *
 * @module
 */

// Main listener (Node.js - default for backward compatibility)
export { NodeHTTPListener } from './adapters/node/index.js';

// Note: For framework-specific adapters, use the following imports:
// - Express: import { ExpressMiddleware } from 'ai.matey/http/express'
// - Koa: import { KoaMiddleware } from 'ai.matey/http/koa'
// - Hono: import { HonoMiddleware } from 'ai.matey/http/hono'
// - Fastify: import { FastifyHandler } from 'ai.matey/http/fastify'
// - Deno: import { DenoHandler } from 'ai.matey/http/deno'

// Backward compatibility - re-export convenience functions from old listener
export {
  createSimpleListener,
  createLoggingListener,
  createSecureListener,
} from './listener.js';

// Types
export type {
  HTTPRequestHandler,
  HTTPListenerOptions,
  CORSOptions,
  RateLimitOptions,
  RouteConfig,
  AuthValidator,
  ErrorHandler,
  RateLimitKeyGenerator,
  RateLimitHandler,
  ParsedRequest,
  RateLimitState,
  MatchedRoute,
} from './types.js';

// Request parsing
export {
  parseRequest,
  extractBearerToken,
  getClientIP,
} from './request-parser.js';

// Response formatting
export {
  sendJSON,
  sendError,
  sendSSEHeaders,
  sendSSEChunk,
  sendSSEEvent,
  sendSSEDone,
  sendSSEError,
  sendText,
  sendNoContent,
  detectProviderFormat,
} from './response-formatter.js';

// CORS
export {
  normalizeCORSOptions,
  handleCORS,
  handlePreflight,
  isPreflight,
} from './cors.js';

// Authentication
export {
  defaultAuthValidator,
  createBearerTokenValidator,
  createAPIKeyValidator,
  createBasicAuthValidator,
  combineAuthValidators,
  requireAllAuth,
  skipAuthForPaths,
} from './auth.js';

// Rate limiting
export {
  RateLimiter,
  userIDKeyGenerator,
  tokenKeyGenerator,
  combineKeyGenerators,
} from './rate-limiter.js';

// Error handling
export {
  defaultErrorHandler,
  createLoggingErrorHandler,
  createReportingErrorHandler,
  wrapErrorHandler,
  isRetryableError,
  isClientError,
  isServerError,
} from './error-handler.js';

// Streaming
export {
  handleStreamingRequest,
  SSEKeepAlive,
  onClientDisconnect,
  supportsStreaming,
  createAbortController,
} from './streaming-handler.js';

// Routing
export {
  RouteMatcher,
  createDefaultRoutes,
  normalizePath,
  applyPathPrefix,
} from './route-matcher.js';

// Health checks
export {
  HealthCheck,
  createHealthCheck,
  createHealthCheckMiddleware,
  createReadinessCheck,
  createLivenessCheck,
  type HealthCheckConfig,
  type HealthCheckResult,
  type HealthStatus,
  type ComponentHealth,
} from './health.js';
