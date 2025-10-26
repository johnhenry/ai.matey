/**
 * Universal AI Adapter System
 *
 * Provider-agnostic interface for AI APIs. Write once, run with any provider.
 *
 * @example
 * ```typescript
 * import { Bridge, OpenAIFrontendAdapter, AnthropicBackendAdapter } from 'ai.matey';
 *
 * // Create bridge connecting OpenAI frontend to Anthropic backend
 * const bridge = new Bridge(
 *   new OpenAIFrontendAdapter(),
 *   new AnthropicBackendAdapter({ apiKey: 'sk-...' })
 * );
 *
 * // Use OpenAI format, execute on Anthropic
 * const response = await bridge.chat({
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 * ```
 *
 * @module
 */

// ============================================================================
// Core Types
// ============================================================================

// IR (Intermediate Representation)
export type {
  // Messages
  MessageRole,
  MessageContent,
  TextContent,
  ImageContent,
  ToolUseContent,
  ToolResultContent,
  IRMessage,
  // Tools
  JSONSchema,
  JSONSchemaType,
  IRTool,
  // Parameters
  IRParameters,
  // Capabilities
  SystemMessageStrategy,
  IRCapabilities,
  // Metadata
  IRProvenance,
  IRMetadata,
  // Request/Response
  IRChatRequest,
  IRChatResponse,
  FinishReason,
  IRUsage,
  // Streaming
  IRChatStream,
  IRStreamChunk,
  StreamChunkType,
  StreamStartChunk,
  StreamContentChunk,
  StreamToolUseChunk,
  StreamMetadataChunk,
  StreamDoneChunk,
  StreamErrorChunk,
} from './types/ir.js';

// Adapters
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
} from './types/adapters.js';

// Bridge types
export type {
  Bridge as IBridge,
  BridgeConfig,
  RequestOptions,
  BridgeEvent,
  RequestEvent,
  StreamEvent,
  BackendEvent,
  MiddlewareEvent,
  BridgeEventData,
  BridgeEventListener,
  BridgeStats,
  BridgeBuilder,
} from './types/bridge.js';

// Router
export type {
  Router as IRouter,
  RouterConfig,
  CustomRoutingFunction,
  CustomFallbackFunction,
  RoutingContext,
  BackendInfo,
  BackendStats,
  RouterStats,
  ParallelDispatchOptions,
  ParallelDispatchResult,
  ModelMapping,
  ModelPatternMapping,
} from './types/router.js';

// Middleware
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
} from './types/middleware.js';

// Streaming Configuration
export type {
  StreamMode,
  StreamingConfig,
} from './types/streaming.js';

export { DEFAULT_STREAMING_CONFIG } from './types/streaming.js';

// Errors (types and classes)
export type {
  ErrorCode,
  ErrorCategory,
  ErrorProvenance,
  HttpErrorContext,
  ProviderErrorDetails,
  ValidationErrorDetails,
  RateLimitErrorDetails,
} from './types/errors.js';

export {
  // Error code constants
  ErrorCode as ErrorCodeEnum,
  ErrorCategory as ErrorCategoryEnum,
  ERROR_CODE_CATEGORIES,
  // Error classes
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
  // Error factories
  createErrorFromHttpResponse,
  createErrorFromProviderError,
} from './errors/index.js';

// ============================================================================
// Utilities
// ============================================================================

export {
  // Validation
  isValidMessageRole,
  validateMessageContent,
  validateMessage,
  validateMessages,
  validateTemperature,
  validateMaxTokens,
  validateTopP,
  validateParameters,
  validateIRChatRequest,
  // System messages
  extractSystemMessages,
  combineSystemMessages,
  getFirstSystemMessage,
  normalizeSystemMessages,
  addSystemMessage,
  hasSystemMessages,
  countSystemMessages,
  // Parameter normalization
  normalizeTemperature,
  denormalizeTemperature,
  normalizeTopP,
  normalizeTopK,
  normalizePenalty,
  normalizeStopSequences,
  filterUnsupportedParameters,
  applyParameterDefaults,
  mergeParameters,
  clampParameter,
  sanitizeParameters,
  areParametersValid,
  // Streaming
  createStreamAccumulator,
  accumulateChunk,
  accumulatorToMessage,
  accumulatorToResponse,
  transformStream,
  filterStream,
  mapStream,
  tapStream,
  collectStream,
  streamToResponse,
  streamToText,
  splitStream,
  catchStreamErrors,
  streamWithTimeout,
  isContentChunk,
  isDoneChunk,
  getContentDeltas,
  // Response conversion (for debugging - standalone functions only)
  toOpenAI,
  toAnthropic,
  toGemini,
  toOllama,
  toMistral,
  toOpenAIStream,
  toAnthropicStream,
  toGeminiStream,
  toMistralStream,
  toMultipleFormats,
  // Request conversion (for debugging - standalone functions only)
  toOpenAIRequest,
  toAnthropicRequest,
  toGeminiRequest,
  toOllamaRequest,
  toMistralRequest,
  toMultipleRequestFormats,
} from './utils/index.js';

export type { StreamAccumulator } from './utils/streaming.js';

// Model Translation
export {
  translateModel,
  createModelTranslator,
  reverseMapping,
  hasTranslation,
  mergeMappings,
  validateMapping,
} from './core/model-translation.js';

export type {
  ModelMapping as ModelTranslationMapping,
  ModelTranslationStrategy,
  ModelTranslationConfig,
  ModelTranslationOptions,
  TranslationResult,
} from './core/model-translation.js';

// Model Listing & Capabilities
export type {
  AIModel,
  ModelCapabilities,
  ListModelsOptions,
  ListModelsResult,
} from './types/models.js';

// Model Pricing
export {
  getModelPricing,
  getModelCapabilities,
  getAllPricedModels,
  getModelsByFamily,
  setPricingOverride,
  clearPricingOverride,
  clearAllPricingOverrides,
  getPricingWithOverrides,
} from './core/model-pricing.js';

export type {
  ModelPricing as CoreModelPricing,
  ExtendedModelCapabilities,
} from './core/model-pricing.js';

// Capability Inference
export {
  inferCapabilities,
  mergeCapabilities,
  meetsRequirements,
  calculateCapabilitySimilarity,
} from './core/capability-inference.js';

// Capability-Based Matching
export {
  matchModels,
  findBestModel,
  getTopMatches,
  filterByRequirements,
} from './core/capability-matcher.js';

export type {
  OptimizationStrategy,
  CapabilityRequirements,
  ScoredModel,
  BackendModel,
} from './core/capability-matcher.js';

// ============================================================================
// Core Components
// ============================================================================

export { Bridge, createBridge } from './core/bridge.js';
export { Router, createRouter } from './core/router.js';
export { MiddlewareStack, createMiddlewareContext, createStreamingMiddlewareContext } from './core/middleware-stack.js';

// ============================================================================
// Middleware
// ============================================================================

export {
  // Logging
  createLoggingMiddleware,
  type LoggingConfig,
  type LogLevel,
  type Logger,
  // Telemetry
  createTelemetryMiddleware,
  ConsoleTelemetrySink,
  InMemoryTelemetrySink,
  MetricNames,
  EventNames,
  type TelemetryConfig,
  // Caching
  createCachingMiddleware,
  InMemoryCacheStorage,
  type CachingConfig,
  // Retry
  createRetryMiddleware,
  isRateLimitError,
  isNetworkError,
  isServerError,
  createRetryPredicate,
  type RetryConfig,
  // Transform
  createTransformMiddleware,
  createPromptRewriter,
  createParameterModifier,
  createResponseFilter,
  createSystemMessageInjector,
  createMessageFilter,
  createContentSanitizer,
  composeRequestTransformers,
  composeResponseTransformers,
  composeMessageTransformers,
  type TransformConfig,
  type RequestTransformer,
  type ResponseTransformer,
  type MessageTransformer,
  // Security
  createSecurityMiddleware,
  createProductionSecurityMiddleware,
  createDevelopmentSecurityMiddleware,
  type SecurityConfig,
  DEFAULT_SECURITY_CONFIG,
  // Cost Tracking
  createCostTrackingMiddleware,
  createStreamingCostTrackingMiddleware,
  InMemoryCostStorage,
  calculateCost,
  getCostStats,
  DEFAULT_PRICING,
  type CostTrackingConfig,
  type CostCalculation,
  type CostStorage,
  type ProviderPricing,
  type ModelPricing,
  // Validation
  createValidationMiddleware,
  createProductionValidationMiddleware,
  createDevelopmentValidationMiddleware,
  detectPII,
  redactPII,
  detectPromptInjection,
  sanitizeText,
  validateRequest,
  sanitizeRequest,
  ValidationError as MiddlewareValidationError,
  DEFAULT_PII_PATTERNS,
  DEFAULT_INJECTION_PATTERNS,
  type ValidationConfig,
  type ValidationResult,
  type PIIDetectionResult,
  type ModerationResult,
} from './middleware/index.js';

// ============================================================================
// Adapters
// ============================================================================

// Frontend Adapters
export { AnthropicFrontendAdapter } from './adapters/frontend/anthropic.js';
export type {
  AnthropicRequest,
  AnthropicResponse,
  AnthropicMessage,
  AnthropicContentBlock,
  AnthropicStreamEvent,
} from './adapters/frontend/anthropic.js';

export { OpenAIFrontendAdapter } from './adapters/frontend/openai.js';
export { GeminiFrontendAdapter } from './adapters/frontend/gemini.js';
export { OllamaFrontendAdapter } from './adapters/frontend/ollama.js';
export { MistralFrontendAdapter } from './adapters/frontend/mistral.js';
export { ChromeAIFrontendAdapter } from './adapters/frontend/chrome-ai.js';

// Backend Adapters
export { AnthropicBackendAdapter } from './adapters/backend/anthropic.js';
export { OpenAIBackendAdapter } from './adapters/backend/openai.js';
export type {
  OpenAIRequest,
  OpenAIResponse,
  OpenAIMessage,
  OpenAIMessageContent,
  OpenAIStreamChunk,
} from './adapters/backend/openai.js';

export { GeminiBackendAdapter } from './adapters/backend/gemini.js';
export { OllamaBackendAdapter } from './adapters/backend/ollama.js';
export { MistralBackendAdapter } from './adapters/backend/mistral.js';
export { ChromeAIBackendAdapter } from './adapters/backend/chrome-ai.js';
export {
  MockBackendAdapter,
  createEchoBackend,
  createErrorBackend,
  createDelayedBackend,
  type MockBackendConfig,
  type MockResponse,
} from './adapters/backend/mock.js';

// New provider adapters
export { DeepSeekBackendAdapter, createDeepSeekAdapter } from './adapters/backend/deepseek.js';
export { GroqBackendAdapter, createGroqAdapter } from './adapters/backend/groq.js';
export { LMStudioBackendAdapter, createLMStudioAdapter } from './adapters/backend/lmstudio.js';
export { HuggingFaceBackendAdapter, createHuggingFaceAdapter } from './adapters/backend/huggingface.js';
export { NVIDIABackendAdapter, createNVIDIAAdapter } from './adapters/backend/nvidia.js';

// ============================================================================
// Wrappers
// ============================================================================

// Chrome AI Wrapper (current API)
export {
  ChromeAILanguageModel,
  createChromeAILanguageModel,
} from './wrappers/chrome-ai.js';

export type {
  ChromeAIPrompt,
  ChromeAICreateOptions,
  ChromeAISession,
  ChromeAILanguageModelAPI,
} from './wrappers/chrome-ai.js';

// Legacy Chrome AI Wrapper (old API before recent changes)
export {
  LegacyChromeAILanguageModel,
  createLegacyWindowAI,
  polyfillLegacyWindowAI,
} from './wrappers/chrome-ai-legacy.js';

export type {
  LegacyChromeAIPrompt,
  LegacyChromeAICreateOptions,
  LegacyChromeAISession,
  LegacyChromeAILanguageModelAPI,
} from './wrappers/chrome-ai-legacy.js';

// OpenAI SDK Wrapper
export {
  OpenAI,
  OpenAIClient,
  Chat,
  ChatCompletions,
} from './wrappers/openai-sdk.js';

export type {
  OpenAIMessage as OpenAISDKMessage,
  OpenAIChatCompletionParams,
  OpenAIChatCompletion,
  OpenAIChatCompletionChunk,
  OpenAISDKConfig,
} from './wrappers/openai-sdk.js';

// Anthropic SDK Wrapper
export {
  Anthropic,
  AnthropicClient,
  Messages,
} from './wrappers/anthropic-sdk.js';

export type {
  AnthropicSDKMessage,
  AnthropicMessageParams,
  AnthropicSDKMessageResponse,
  AnthropicStreamEvent as AnthropicSDKStreamEvent,
  AnthropicSDKConfig,
} from './wrappers/anthropic-sdk.js';

// ============================================================================
// Constants
// ============================================================================

export { FallbackStrategy, RoutingStrategy, ParallelStrategy } from './types/router.js';
export { BridgeEventType } from './types/bridge.js';
