/**
 * Middleware Exports
 *
 * All middleware implementations for the Universal AI Adapter System.
 *
 * @module
 */

// Logging middleware
export {
  createLoggingMiddleware,
  type LoggingConfig,
  type LogLevel,
  type Logger,
} from './logging.js';

// Telemetry middleware
export {
  createTelemetryMiddleware,
  ConsoleTelemetrySink,
  InMemoryTelemetrySink,
  MetricNames,
  EventNames,
  type TelemetryConfig,
} from './telemetry.js';

// Caching middleware
export {
  createCachingMiddleware,
  InMemoryCacheStorage,
  type CachingConfig,
} from './caching.js';

// Retry middleware
export {
  createRetryMiddleware,
  isRateLimitError,
  isNetworkError,
  isServerError,
  createRetryPredicate,
  type RetryConfig,
} from './retry.js';

// Transform middleware
export {
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
} from './transform.js';

// Conversation history middleware
export {
  createConversationHistoryMiddleware,
  simpleConversationHistory,
  statelessConversation,
  conversationOnlyHistory,
  type ConversationHistoryConfig,
  type ConversationHistoryManager,
} from './conversation-history.js';

// Security middleware
export {
  createSecurityMiddleware,
  createProductionSecurityMiddleware,
  createDevelopmentSecurityMiddleware,
  type SecurityConfig,
  DEFAULT_SECURITY_CONFIG,
} from './security.js';

// Cost tracking middleware
export {
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
} from './cost-tracking.js';

// Validation middleware
export {
  createValidationMiddleware,
  createProductionValidationMiddleware,
  createDevelopmentValidationMiddleware,
  detectPII,
  redactPII,
  detectPromptInjection,
  sanitizeText,
  validateRequest,
  sanitizeRequest,
  ValidationError,
  DEFAULT_PII_PATTERNS,
  DEFAULT_INJECTION_PATTERNS,
  type ValidationConfig,
  type ValidationResult,
  type PIIDetectionResult,
  type ModerationResult,
} from './validation.js';
