/**
 * HTTP Core Module
 *
 * Framework-agnostic HTTP utilities for the Universal AI Adapter System.
 * This package provides the core logic for HTTP request handling that can
 * be adapted to any HTTP framework.
 *
 * @module
 */

// Core handler
export { CoreHTTPHandler } from './handler.js';

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
  GenericRequest,
  GenericResponse,
  GenericAuthValidator,
  GenericErrorHandler,
  GenericRateLimitKeyGenerator,
  GenericRateLimitHandler,
  GenericRateLimitOptions,
  CoreHandlerOptions,
  ParsedGenericRequest,
} from './types.js';

// Request parsing
export { parseRequest, extractBearerToken, getClientIP } from './request-parser.js';

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
export { normalizeCORSOptions, handleCORS, handlePreflight, isPreflight } from './cors.js';

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
