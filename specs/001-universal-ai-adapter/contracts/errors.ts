/**
 * Error Types and Codes - SPECIFICATION
 *
 * This file defines the PLANNED error types and error handling behavior for the Universal AI Adapter.
 *
 * ## ⚠️  Implementation Status
 *
 * **This is a SPECIFICATION file, not the implementation.**
 *
 * - **Implementation:** `packages/ai.matey.errors/src/index.ts` (386 lines)
 * - **This spec:** 773 lines (includes planned features not yet implemented)
 *
 * ### ✅ What's Implemented (in packages/ai.matey.errors)
 * - AdapterError (base class)
 * - AuthenticationError
 * - AuthorizationError
 * - RateLimitError
 * - ValidationError
 * - ProviderError
 * - AdapterConversionError
 * - NetworkError
 *
 * ### ⏳ What's Planned (in this spec but not implemented)
 * - StreamError - Streaming-specific errors
 * - RouterError - Router-specific errors
 * - MiddlewareError - Middleware-specific errors
 * - Enhanced error recovery strategies
 * - Error context and chaining
 * - Additional error codes and categorization
 *
 * When implementing new error types, copy from this spec and add to the implementation package.
 *
 * ---
 *
 * Normalized error handling across all AI providers. Provider-specific errors
 * are translated to universal error types with actionable context.
 *
 * Design principles:
 * - Actionable: Errors include enough context for developers to fix issues
 * - Traceable: Include adapter provenance and IR state at failure
 * - Normalized: Provider-specific error codes mapped to universal categories
 * - Type-safe: Use discriminated unions for compile-time error type checking
 *
 * @example
 * ```typescript
 * try {
 *   await bridge.chat(request);
 * } catch (error) {
 *   if (error instanceof AdapterError) {
 *     if (error.code === ErrorCode.RATE_LIMIT_EXCEEDED) {
 *       console.log(`Rate limited. Retry after ${error.retryAfter}ms`);
 *     }
 *   }
 * }
 * ```
 */

import type { IRChatRequest, IRChatResponse, IRMetadata } from './ir';

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Universal error codes covering all adapter failure modes.
 *
 * Grouped by category for easier handling:
 * - Authentication: API key issues
 * - Authorization: Permission issues
 * - Rate Limiting: Quota exceeded
 * - Validation: Invalid input
 * - Provider: Upstream API issues
 * - Adapter: Translation/conversion issues
 * - Network: Connectivity issues
 * - Streaming: Stream-specific issues
 */
export const ErrorCode = {
  // Authentication errors (40x)
  INVALID_API_KEY: 'INVALID_API_KEY',
  MISSING_API_KEY: 'MISSING_API_KEY',
  EXPIRED_API_KEY: 'EXPIRED_API_KEY',

  // Authorization errors (40x)
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Validation errors (400)
  INVALID_REQUEST: 'INVALID_REQUEST',
  INVALID_MESSAGE_FORMAT: 'INVALID_MESSAGE_FORMAT',
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',
  UNSUPPORTED_MODEL: 'UNSUPPORTED_MODEL',
  UNSUPPORTED_FEATURE: 'UNSUPPORTED_FEATURE',
  CONTEXT_LENGTH_EXCEEDED: 'CONTEXT_LENGTH_EXCEEDED',

  // Provider errors (50x)
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  PROVIDER_TIMEOUT: 'PROVIDER_TIMEOUT',
  PROVIDER_OVERLOADED: 'PROVIDER_OVERLOADED',

  // Adapter errors
  ADAPTER_CONVERSION_ERROR: 'ADAPTER_CONVERSION_ERROR',
  ADAPTER_VALIDATION_ERROR: 'ADAPTER_VALIDATION_ERROR',
  UNSUPPORTED_CONVERSION: 'UNSUPPORTED_CONVERSION',
  SEMANTIC_DRIFT_ERROR: 'SEMANTIC_DRIFT_ERROR',

  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
  DNS_RESOLUTION_FAILED: 'DNS_RESOLUTION_FAILED',

  // Streaming errors
  STREAM_ERROR: 'STREAM_ERROR',
  STREAM_INTERRUPTED: 'STREAM_INTERRUPTED',
  STREAM_PARSE_ERROR: 'STREAM_PARSE_ERROR',
  STREAM_CANCELLED: 'STREAM_CANCELLED',

  // Router errors
  NO_BACKEND_AVAILABLE: 'NO_BACKEND_AVAILABLE',
  ROUTING_FAILED: 'ROUTING_FAILED',
  ALL_BACKENDS_FAILED: 'ALL_BACKENDS_FAILED',

  // Middleware errors
  MIDDLEWARE_ERROR: 'MIDDLEWARE_ERROR',

  // Generic errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

// ============================================================================
// Error Categories
// ============================================================================

/**
 * Groups error codes into categories for easier handling.
 */
export const ErrorCategory = {
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  RATE_LIMIT: 'rate_limit',
  VALIDATION: 'validation',
  PROVIDER: 'provider',
  ADAPTER: 'adapter',
  NETWORK: 'network',
  STREAMING: 'streaming',
  ROUTING: 'routing',
  MIDDLEWARE: 'middleware',
  UNKNOWN: 'unknown',
} as const;

export type ErrorCategory = typeof ErrorCategory[keyof typeof ErrorCategory];

/**
 * Maps error codes to their categories.
 */
export const ERROR_CODE_CATEGORIES: Record<ErrorCode, ErrorCategory> = {
  [ErrorCode.INVALID_API_KEY]: ErrorCategory.AUTHENTICATION,
  [ErrorCode.MISSING_API_KEY]: ErrorCategory.AUTHENTICATION,
  [ErrorCode.EXPIRED_API_KEY]: ErrorCategory.AUTHENTICATION,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: ErrorCategory.AUTHORIZATION,
  [ErrorCode.QUOTA_EXCEEDED]: ErrorCategory.AUTHORIZATION,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: ErrorCategory.RATE_LIMIT,
  [ErrorCode.INVALID_REQUEST]: ErrorCategory.VALIDATION,
  [ErrorCode.INVALID_MESSAGE_FORMAT]: ErrorCategory.VALIDATION,
  [ErrorCode.INVALID_PARAMETERS]: ErrorCategory.VALIDATION,
  [ErrorCode.UNSUPPORTED_MODEL]: ErrorCategory.VALIDATION,
  [ErrorCode.UNSUPPORTED_FEATURE]: ErrorCategory.VALIDATION,
  [ErrorCode.CONTEXT_LENGTH_EXCEEDED]: ErrorCategory.VALIDATION,
  [ErrorCode.PROVIDER_ERROR]: ErrorCategory.PROVIDER,
  [ErrorCode.PROVIDER_UNAVAILABLE]: ErrorCategory.PROVIDER,
  [ErrorCode.PROVIDER_TIMEOUT]: ErrorCategory.PROVIDER,
  [ErrorCode.PROVIDER_OVERLOADED]: ErrorCategory.PROVIDER,
  [ErrorCode.ADAPTER_CONVERSION_ERROR]: ErrorCategory.ADAPTER,
  [ErrorCode.ADAPTER_VALIDATION_ERROR]: ErrorCategory.ADAPTER,
  [ErrorCode.UNSUPPORTED_CONVERSION]: ErrorCategory.ADAPTER,
  [ErrorCode.SEMANTIC_DRIFT_ERROR]: ErrorCategory.ADAPTER,
  [ErrorCode.NETWORK_ERROR]: ErrorCategory.NETWORK,
  [ErrorCode.CONNECTION_TIMEOUT]: ErrorCategory.NETWORK,
  [ErrorCode.DNS_RESOLUTION_FAILED]: ErrorCategory.NETWORK,
  [ErrorCode.STREAM_ERROR]: ErrorCategory.STREAMING,
  [ErrorCode.STREAM_INTERRUPTED]: ErrorCategory.STREAMING,
  [ErrorCode.STREAM_PARSE_ERROR]: ErrorCategory.STREAMING,
  [ErrorCode.STREAM_CANCELLED]: ErrorCategory.STREAMING,
  [ErrorCode.NO_BACKEND_AVAILABLE]: ErrorCategory.ROUTING,
  [ErrorCode.ROUTING_FAILED]: ErrorCategory.ROUTING,
  [ErrorCode.ALL_BACKENDS_FAILED]: ErrorCategory.ROUTING,
  [ErrorCode.MIDDLEWARE_ERROR]: ErrorCategory.MIDDLEWARE,
  [ErrorCode.UNKNOWN_ERROR]: ErrorCategory.UNKNOWN,
  [ErrorCode.INTERNAL_ERROR]: ErrorCategory.UNKNOWN,
};

// ============================================================================
// Error Details Types
// ============================================================================

/**
 * Context about where an error occurred in the adapter chain.
 */
export interface ErrorProvenance {
  /**
   * Frontend adapter that initiated the request.
   */
  readonly frontend?: string;

  /**
   * Backend adapter that was processing the request.
   */
  readonly backend?: string;

  /**
   * Middleware layer where error occurred (if applicable).
   */
  readonly middleware?: string;

  /**
   * Router that was handling the request (if applicable).
   */
  readonly router?: string;
}

/**
 * HTTP status code and additional HTTP context.
 */
export interface HttpErrorContext {
  readonly statusCode: number;
  readonly statusText?: string;
  readonly headers?: Record<string, string>;
  readonly responseBody?: unknown;
}

/**
 * Provider-specific error information.
 */
export interface ProviderErrorDetails {
  /**
   * Original error code from provider.
   */
  readonly providerCode?: string;

  /**
   * Original error message from provider.
   */
  readonly providerMessage?: string;

  /**
   * Provider name (openai, anthropic, gemini, etc.).
   */
  readonly provider: string;

  /**
   * Provider-specific error data.
   */
  readonly providerData?: Record<string, unknown>;
}

/**
 * Validation error details.
 */
export interface ValidationErrorDetails {
  /**
   * Field or parameter that failed validation.
   */
  readonly field: string;

  /**
   * Value that failed validation.
   */
  readonly value: unknown;

  /**
   * Why validation failed.
   */
  readonly reason: string;

  /**
   * Expected format or constraint.
   */
  readonly expected?: string;
}

/**
 * Rate limit error details.
 */
export interface RateLimitErrorDetails {
  /**
   * Time until rate limit resets (milliseconds).
   */
  readonly retryAfter?: number;

  /**
   * Rate limit ceiling (requests per period).
   */
  readonly limit?: number;

  /**
   * Remaining requests in current period.
   */
  readonly remaining?: number;

  /**
   * When limit resets (ISO timestamp).
   */
  readonly resetAt?: string;
}

// ============================================================================
// Base Error Class
// ============================================================================

/**
 * Base error class for all adapter errors.
 *
 * Extends native Error with adapter-specific context.
 *
 * @example
 * ```typescript
 * try {
 *   const response = await bridge.chat(request);
 * } catch (error) {
 *   if (error instanceof AdapterError) {
 *     console.error('Adapter error:', error.code);
 *     console.error('Category:', error.category);
 *     console.error('Provenance:', error.provenance);
 *
 *     if (error.isRetryable) {
 *       console.log('Error is retryable, attempting retry...');
 *     }
 *   }
 * }
 * ```
 */
export class AdapterError extends Error {
  /**
   * Universal error code.
   */
  readonly code: ErrorCode;

  /**
   * Error category for grouped handling.
   */
  readonly category: ErrorCategory;

  /**
   * Whether error might succeed on retry.
   */
  readonly isRetryable: boolean;

  /**
   * Where in the adapter chain the error occurred.
   */
  readonly provenance: ErrorProvenance;

  /**
   * Original error that caused this error (if any).
   */
  readonly cause?: Error;

  /**
   * IR state at the time of error.
   */
  readonly irState?: {
    readonly request?: Partial<IRChatRequest>;
    readonly response?: Partial<IRChatResponse>;
  };

  /**
   * Additional error-specific details.
   */
  readonly details?: Record<string, unknown>;

  /**
   * Timestamp when error occurred.
   */
  readonly timestamp: number;

  constructor(options: {
    code: ErrorCode;
    message: string;
    isRetryable?: boolean;
    provenance?: ErrorProvenance;
    cause?: Error;
    irState?: {
      request?: Partial<IRChatRequest>;
      response?: Partial<IRChatResponse>;
    };
    details?: Record<string, unknown>;
  }) {
    super(options.message);
    this.name = 'AdapterError';
    this.code = options.code;
    this.category = ERROR_CODE_CATEGORIES[options.code];
    this.isRetryable = options.isRetryable ?? false;
    this.provenance = options.provenance ?? {};
    this.cause = options.cause;
    this.irState = options.irState;
    this.details = options.details;
    this.timestamp = Date.now();

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AdapterError);
    }
  }

  /**
   * Get category-specific helper method.
   */
  isCategory(category: ErrorCategory): boolean {
    return this.category === category;
  }

  /**
   * Convert to JSON for logging/serialization.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      message: this.message,
      isRetryable: this.isRetryable,
      provenance: this.provenance,
      irState: this.irState,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack,
      cause: this.cause
        ? {
            name: this.cause.name,
            message: this.cause.message,
            stack: this.cause.stack,
          }
        : undefined,
    };
  }
}

// ============================================================================
// Specialized Error Classes
// ============================================================================

/**
 * Authentication error (API key issues).
 */
export class AuthenticationError extends AdapterError {
  constructor(options: {
    code: typeof ErrorCode.INVALID_API_KEY | typeof ErrorCode.MISSING_API_KEY | typeof ErrorCode.EXPIRED_API_KEY;
    message: string;
    provenance?: ErrorProvenance;
    cause?: Error;
  }) {
    super({
      ...options,
      isRetryable: false,
    });
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error (permissions, quota).
 */
export class AuthorizationError extends AdapterError {
  constructor(options: {
    code: typeof ErrorCode.INSUFFICIENT_PERMISSIONS | typeof ErrorCode.QUOTA_EXCEEDED;
    message: string;
    provenance?: ErrorProvenance;
    cause?: Error;
  }) {
    super({
      ...options,
      isRetryable: false,
    });
    this.name = 'AuthorizationError';
  }
}

/**
 * Rate limit error with retry information.
 */
export class RateLimitError extends AdapterError {
  readonly retryAfter?: number;
  readonly limit?: number;
  readonly remaining?: number;
  readonly resetAt?: string;

  constructor(options: {
    message: string;
    provenance?: ErrorProvenance;
    cause?: Error;
    rateLimitDetails?: RateLimitErrorDetails;
  }) {
    super({
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
      message: options.message,
      isRetryable: true,
      provenance: options.provenance,
      cause: options.cause,
      details: options.rateLimitDetails,
    });
    this.name = 'RateLimitError';
    this.retryAfter = options.rateLimitDetails?.retryAfter;
    this.limit = options.rateLimitDetails?.limit;
    this.remaining = options.rateLimitDetails?.remaining;
    this.resetAt = options.rateLimitDetails?.resetAt;
  }
}

/**
 * Validation error with field-specific context.
 */
export class ValidationError extends AdapterError {
  readonly validationDetails: ValidationErrorDetails[];

  constructor(options: {
    code:
      | typeof ErrorCode.INVALID_REQUEST
      | typeof ErrorCode.INVALID_MESSAGE_FORMAT
      | typeof ErrorCode.INVALID_PARAMETERS
      | typeof ErrorCode.UNSUPPORTED_MODEL
      | typeof ErrorCode.UNSUPPORTED_FEATURE
      | typeof ErrorCode.CONTEXT_LENGTH_EXCEEDED;
    message: string;
    validationDetails: ValidationErrorDetails[];
    provenance?: ErrorProvenance;
    irState?: {
      request?: Partial<IRChatRequest>;
    };
  }) {
    super({
      ...options,
      isRetryable: false,
      details: { validationDetails: options.validationDetails },
    });
    this.name = 'ValidationError';
    this.validationDetails = options.validationDetails;
  }
}

/**
 * Provider error (upstream API issues).
 */
export class ProviderError extends AdapterError {
  readonly providerDetails?: ProviderErrorDetails;
  readonly httpContext?: HttpErrorContext;

  constructor(options: {
    code:
      | typeof ErrorCode.PROVIDER_ERROR
      | typeof ErrorCode.PROVIDER_UNAVAILABLE
      | typeof ErrorCode.PROVIDER_TIMEOUT
      | typeof ErrorCode.PROVIDER_OVERLOADED;
    message: string;
    isRetryable?: boolean;
    provenance?: ErrorProvenance;
    cause?: Error;
    providerDetails?: ProviderErrorDetails;
    httpContext?: HttpErrorContext;
    irState?: {
      request?: Partial<IRChatRequest>;
      response?: Partial<IRChatResponse>;
    };
  }) {
    super({
      ...options,
      details: {
        ...options.providerDetails,
        ...options.httpContext,
      },
    });
    this.name = 'ProviderError';
    this.providerDetails = options.providerDetails;
    this.httpContext = options.httpContext;
  }
}

/**
 * Adapter conversion error (translation issues).
 */
export class AdapterConversionError extends AdapterError {
  constructor(options: {
    code:
      | typeof ErrorCode.ADAPTER_CONVERSION_ERROR
      | typeof ErrorCode.ADAPTER_VALIDATION_ERROR
      | typeof ErrorCode.UNSUPPORTED_CONVERSION
      | typeof ErrorCode.SEMANTIC_DRIFT_ERROR;
    message: string;
    provenance?: ErrorProvenance;
    cause?: Error;
    irState?: {
      request?: Partial<IRChatRequest>;
      response?: Partial<IRChatResponse>;
    };
  }) {
    super({
      ...options,
      isRetryable: false,
    });
    this.name = 'AdapterConversionError';
  }
}

/**
 * Network error (connectivity issues).
 */
export class NetworkError extends AdapterError {
  constructor(options: {
    code:
      | typeof ErrorCode.NETWORK_ERROR
      | typeof ErrorCode.CONNECTION_TIMEOUT
      | typeof ErrorCode.DNS_RESOLUTION_FAILED;
    message: string;
    provenance?: ErrorProvenance;
    cause?: Error;
  }) {
    super({
      ...options,
      isRetryable: true,
    });
    this.name = 'NetworkError';
  }
}

/**
 * Streaming error (stream-specific issues).
 */
export class StreamError extends AdapterError {
  constructor(options: {
    code:
      | typeof ErrorCode.STREAM_ERROR
      | typeof ErrorCode.STREAM_INTERRUPTED
      | typeof ErrorCode.STREAM_PARSE_ERROR
      | typeof ErrorCode.STREAM_CANCELLED;
    message: string;
    provenance?: ErrorProvenance;
    cause?: Error;
    irState?: {
      request?: Partial<IRChatRequest>;
    };
  }) {
    super({
      ...options,
      isRetryable: options.code === ErrorCode.STREAM_INTERRUPTED,
    });
    this.name = 'StreamError';
  }
}

/**
 * Router error (routing issues).
 */
export class RouterError extends AdapterError {
  readonly attemptedBackends?: string[];

  constructor(options: {
    code:
      | typeof ErrorCode.NO_BACKEND_AVAILABLE
      | typeof ErrorCode.ROUTING_FAILED
      | typeof ErrorCode.ALL_BACKENDS_FAILED;
    message: string;
    provenance?: ErrorProvenance;
    cause?: Error;
    attemptedBackends?: string[];
    irState?: {
      request?: Partial<IRChatRequest>;
    };
  }) {
    super({
      ...options,
      isRetryable: options.code === ErrorCode.ALL_BACKENDS_FAILED,
      details: { attemptedBackends: options.attemptedBackends },
    });
    this.name = 'RouterError';
    this.attemptedBackends = options.attemptedBackends;
  }
}

/**
 * Middleware error.
 */
export class MiddlewareError extends AdapterError {
  readonly middlewareName?: string;

  constructor(options: {
    message: string;
    middlewareName?: string;
    provenance?: ErrorProvenance;
    cause?: Error;
    irState?: {
      request?: Partial<IRChatRequest>;
      response?: Partial<IRChatResponse>;
    };
  }) {
    super({
      code: ErrorCode.MIDDLEWARE_ERROR,
      message: options.message,
      isRetryable: false,
      provenance: options.provenance,
      cause: options.cause,
      irState: options.irState,
      details: { middlewareName: options.middlewareName },
    });
    this.name = 'MiddlewareError';
    this.middlewareName = options.middlewareName;
  }
}

// ============================================================================
// Error Factory Functions
// ============================================================================

/**
 * Create adapter error from HTTP response.
 */
export function createErrorFromHttpResponse(
  statusCode: number,
  statusText: string,
  responseBody: unknown,
  provenance: ErrorProvenance
): AdapterError {
  const httpContext: HttpErrorContext = {
    statusCode,
    statusText,
    responseBody,
  };

  // Map HTTP status codes to error types
  if (statusCode === 401) {
    return new AuthenticationError({
      code: ErrorCode.INVALID_API_KEY,
      message: `Authentication failed: ${statusText}`,
      provenance,
    });
  }

  if (statusCode === 403) {
    return new AuthorizationError({
      code: ErrorCode.INSUFFICIENT_PERMISSIONS,
      message: `Authorization failed: ${statusText}`,
      provenance,
    });
  }

  if (statusCode === 429) {
    return new RateLimitError({
      message: `Rate limit exceeded: ${statusText}`,
      provenance,
    });
  }

  if (statusCode === 400) {
    return new ValidationError({
      code: ErrorCode.INVALID_REQUEST,
      message: `Invalid request: ${statusText}`,
      validationDetails: [],
      provenance,
    });
  }

  if (statusCode >= 500) {
    return new ProviderError({
      code: ErrorCode.PROVIDER_ERROR,
      message: `Provider error: ${statusText}`,
      isRetryable: true,
      provenance,
      httpContext,
    });
  }

  return new AdapterError({
    code: ErrorCode.PROVIDER_ERROR,
    message: `HTTP error ${statusCode}: ${statusText}`,
    isRetryable: statusCode >= 500,
    provenance,
    details: httpContext,
  });
}

/**
 * Create error from provider-specific error.
 */
export function createErrorFromProviderError(
  provider: string,
  providerError: unknown,
  provenance: ErrorProvenance
): AdapterError {
  // Provider-specific error mapping would go here
  // This is a simplified version
  return new ProviderError({
    code: ErrorCode.PROVIDER_ERROR,
    message: `Provider error from ${provider}`,
    provenance,
    providerDetails: {
      provider,
      providerMessage: String(providerError),
    },
  });
}
