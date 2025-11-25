/**
 * AI Matey - Universal AI Adapter System
 *
 * Main entry point that re-exports all functionality from sub-packages.
 * This package provides backward compatibility for users migrating from
 * the monolithic package.
 *
 * @module
 */

// Re-export types (excluding error class types which are re-exported from errors)
export {
  // IR types
  type IRChatRequest,
  type IRChatResponse,
  type IRChatStream,
  type IRMessage,
  type IRMetadata,
  type IRParameters,
  type IRStreamChunk,
  type StreamContentChunk,
  type StreamDoneChunk,
  type StreamErrorChunk,
  type MessageContent,
  type MessageRole,
  type TextContent,
  type ImageContent,
  type ToolUseContent,
  type ToolResultContent,
  // Adapter types
  type FrontendAdapter,
  type BackendAdapter,
  type AdapterMetadata,
  type InferFrontendRequest,
  type InferFrontendResponse,
  type InferFrontendStreamChunk,
  // Model types
  type AIModel,
  type ModelCapabilities,
  type ListModelsOptions,
  type ListModelsResult,
  // Bridge types (interface only, implementation from core)
  type BridgeConfig,
  type RequestOptions,
  // Router types (interface only, implementation from core)
  type RouterConfig,
  type RoutingStrategy,
  type FallbackStrategy,
  type RouterStats,
  type BackendInfo,
  type BackendStats,
  type ParallelDispatchOptions,
  type ParallelDispatchResult,
  type ModelPatternMapping,
  type CustomRoutingFunction,
  type CustomFallbackFunction,
  type RoutingContext,
  // Middleware types
  type Middleware,
  type MiddlewareContext,
  type MiddlewareNext,
  type StreamingMiddleware,
  type StreamingMiddlewareNext,
  type StreamingMiddlewareContext,
  // Streaming types
  type StreamMode,
  type StreamingConfig,
  type StreamConversionOptions,
  DEFAULT_STREAMING_CONFIG,
  DEFAULT_CONVERSION_OPTIONS,
  // Model translation types
  type ModelMapping,
  type ModelTranslationConfig,
  type ModelTranslationOptions,
  type ModelTranslationStrategy,
  type TranslationResult,
  // Error types (type definitions only)
  type ErrorCategory,
  type ErrorProvenance,
  type HttpErrorContext,
  type ProviderErrorDetails,
  type ValidationErrorDetails,
  type BaseErrorOptions,
  ERROR_CODE_CATEGORIES,
} from 'ai.matey.types';

// Re-export error classes and factory functions from errors package
// (ErrorCode enum is exported from here instead of types)
export {
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
  ErrorCode,
} from 'ai.matey.errors';

// Re-export all utils
export * from 'ai.matey.utils';

// Re-export core functionality (implementations)
export {
  Bridge,
  createBridge,
  Router,
  createRouter,
  MiddlewareStack,
  createMiddlewareContext,
  createStreamingMiddlewareContext,
} from 'ai.matey.core';
