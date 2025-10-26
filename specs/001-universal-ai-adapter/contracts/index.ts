/**
 * Universal AI Adapter System - TypeScript API Contracts
 *
 * This module exports all public API contracts for the Universal AI Adapter System.
 * These are the TypeScript interfaces and types that define the public API surface.
 *
 * @packageDocumentation
 */

// ============================================================================
// Core IR Types
// ============================================================================

export type {
  // Message types
  MessageRole,
  MessageContent,
  ContentPart,
  ContentPartType,
  TextContentPart,
  ImageContentPart,
  IRMessage,

  // Parameter types
  IRParameters,
  TokenUsage,

  // Request/Response types
  IRChatRequest,
  IRChatResponse,
  IRMetadata,
  FinishReason,

  // Streaming types
  IRChatStream,
  IRStreamChunk,
  StreamChunkType,
  ContentStreamChunk,
  MetadataStreamChunk,
  DoneStreamChunk,

  // Capability types
  IRCapabilities,

  // Semantic transform types
  SemanticTransform,
  SemanticTransforms,
} from './ir';

export {
  MessageRole,
  ContentPartType,
  FinishReason,
  StreamChunkType,
  isMultiPartContent,
  isContentChunk,
  isMetadataChunk,
  isDoneChunk,
} from './ir';

// ============================================================================
// Error Types
// ============================================================================

export type {
  ErrorCode,
  ErrorCategory,
  ErrorProvenance,
  HttpErrorContext,
  ProviderErrorDetails,
  ValidationErrorDetails,
  RateLimitErrorDetails,
} from './errors';

export {
  ErrorCode,
  ErrorCategory,
  ERROR_CODE_CATEGORIES,
  AdapterError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  ValidationError,
  ProviderError,
  AdapterConversionError,
  NetworkError,
  StreamError,
  RouterError,
  MiddlewareError,
  createErrorFromHttpResponse,
  createErrorFromProviderError,
} from './errors';

// ============================================================================
// Adapter Types
// ============================================================================

export type {
  AdapterMetadata,
  FrontendAdapter,
  BackendAdapter,
  BackendAdapterConfig,
  AdapterRegistry,
  AdapterPair,
  InferFrontendRequest,
  InferFrontendResponse,
  InferFrontendStreamChunk,
} from './adapters';

// ============================================================================
// Bridge Types
// ============================================================================

export type {
  Bridge,
  BridgeConfig,
  BridgeBuilder,
  RequestOptions,
  BridgeEventType,
  BridgeEvent,
  BridgeEventData,
  BridgeEventListener,
  RequestEvent,
  StreamEvent,
  BackendEvent,
  MiddlewareEvent,
  BridgeStats,
} from './bridge';

export { BridgeEventType, createBridge } from './bridge';

// ============================================================================
// Router Types
// ============================================================================

export type {
  Router,
  RouterConfig,
  RouterStats,
  RoutingStrategy,
  FallbackStrategy,
  CustomRoutingFunction,
  CustomFallbackFunction,
  RoutingContext,
  BackendInfo,
  BackendStats,
  ParallelStrategy,
  ParallelDispatchOptions,
  ParallelDispatchResult,
  ModelMapping,
  ModelPatternMapping,
} from './router';

export { RoutingStrategy, FallbackStrategy, ParallelStrategy } from './router';

// ============================================================================
// Middleware Types
// ============================================================================

export type {
  Middleware,
  StreamingMiddleware,
  MiddlewareContext,
  StreamingMiddlewareContext,
  MiddlewareNext,
  StreamingMiddlewareNext,
  MiddlewareOptions,
  MiddlewareWithMetadata,
  LoggingMiddlewareConfig,
  CachingMiddlewareConfig,
  CacheStorage,
  TelemetryMiddlewareConfig,
  TelemetrySink,
} from './middleware';

export {
  createMiddleware,
  composeMiddleware,
  createErrorHandler,
  createTimingMiddleware,
  createRequestTransformer,
  createResponseTransformer,
  createConditionalMiddleware,
  createLoggingMiddleware,
  createCachingMiddleware,
  createTelemetryMiddleware,
} from './middleware';
