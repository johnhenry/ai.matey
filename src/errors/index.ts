/**
 * Error Class Implementations
 *
 * Concrete implementations of all error classes defined in types/errors.ts
 *
 * @module
 */

import type {
  ErrorCode,
  ErrorCategory,
  ErrorProvenance,
  HttpErrorContext,
  ProviderErrorDetails,
  ValidationErrorDetails,
  BaseErrorOptions,
  AuthenticationErrorOptions,
  AuthorizationErrorOptions,
  RateLimitErrorOptions,
  ValidationErrorOptions,
  ProviderErrorOptions,
  AdapterConversionErrorOptions,
  NetworkErrorOptions,
  StreamErrorOptions,
  RouterErrorOptions,
  MiddlewareErrorOptions,
} from '../types/errors.js';
import { ErrorCode as ErrorCodeEnum, ERROR_CODE_CATEGORIES } from '../types/errors.js';
import type { IRChatRequest, IRChatResponse } from '../types/ir.js';

// ============================================================================
// Base Error Class
// ============================================================================

/**
 * Base error class for all adapter errors.
 */
export class AdapterError extends Error {
  readonly code: ErrorCode;
  readonly category: ErrorCategory;
  readonly isRetryable: boolean;
  readonly provenance: ErrorProvenance;
  readonly cause?: Error;
  readonly irState?: {
    readonly request?: Partial<IRChatRequest>;
    readonly response?: Partial<IRChatResponse>;
  };
  readonly details?: Record<string, unknown>;
  readonly timestamp: number;

  constructor(options: BaseErrorOptions) {
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
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Check if error belongs to a category.
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
  constructor(options: AuthenticationErrorOptions) {
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
  constructor(options: AuthorizationErrorOptions) {
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

  constructor(options: RateLimitErrorOptions) {
    super({
      code: ErrorCodeEnum.RATE_LIMIT_EXCEEDED,
      message: options.message,
      isRetryable: true,
      provenance: options.provenance,
      cause: options.cause,
      details: options.rateLimitDetails as Record<string, unknown>,
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

  constructor(options: ValidationErrorOptions) {
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

  constructor(options: ProviderErrorOptions) {
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
  constructor(options: AdapterConversionErrorOptions) {
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
  constructor(options: NetworkErrorOptions) {
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
  constructor(options: StreamErrorOptions) {
    super({
      ...options,
      isRetryable: options.code === ErrorCodeEnum.STREAM_INTERRUPTED,
    });
    this.name = 'StreamError';
  }
}

/**
 * Router error (routing issues).
 */
export class RouterError extends AdapterError {
  readonly attemptedBackends?: string[];

  constructor(options: RouterErrorOptions) {
    super({
      ...options,
      isRetryable: options.code === ErrorCodeEnum.ALL_BACKENDS_FAILED,
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

  constructor(options: MiddlewareErrorOptions) {
    super({
      code: ErrorCodeEnum.MIDDLEWARE_ERROR,
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
  const httpContext = {
    statusCode,
    statusText,
    responseBody,
  } as HttpErrorContext;

  // Map HTTP status codes to error types
  if (statusCode === 401) {
    return new AuthenticationError({
      code: ErrorCodeEnum.INVALID_API_KEY,
      message: `Authentication failed: ${statusText}`,
      provenance,
    });
  }

  if (statusCode === 403) {
    return new AuthorizationError({
      code: ErrorCodeEnum.INSUFFICIENT_PERMISSIONS,
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
      code: ErrorCodeEnum.INVALID_REQUEST,
      message: `Invalid request: ${statusText}`,
      validationDetails: [],
      provenance,
    });
  }

  if (statusCode >= 500) {
    return new ProviderError({
      code: ErrorCodeEnum.PROVIDER_ERROR,
      message: `Provider error: ${statusText}`,
      isRetryable: true,
      provenance,
      httpContext,
    });
  }

  return new AdapterError({
    code: ErrorCodeEnum.PROVIDER_ERROR,
    message: `HTTP error ${statusCode}: ${statusText}`,
    isRetryable: statusCode >= 500,
    provenance,
    details: httpContext as unknown as Record<string, unknown>,
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
    code: ErrorCodeEnum.PROVIDER_ERROR,
    message: `Provider error from ${provider}`,
    provenance,
    providerDetails: {
      provider,
      providerMessage: String(providerError),
    },
  });
}

// Re-export error codes and categories
export { ErrorCodeEnum as ErrorCode, ERROR_CODE_CATEGORIES };
export * from '../types/errors.js';
