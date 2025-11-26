/**
 * Tests for ai.matey.errors package
 *
 * Tests for all error classes and factory functions.
 */

import { describe, it, expect } from 'vitest';
import {
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

// ============================================================================
// AdapterError Tests
// ============================================================================

describe('AdapterError', () => {
  it('should create error with required fields', () => {
    const error = new AdapterError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Test error',
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AdapterError);
    expect(error.name).toBe('AdapterError');
    expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(error.message).toBe('Test error');
    expect(error.timestamp).toBeDefined();
    expect(typeof error.timestamp).toBe('number');
  });

  it('should handle optional fields', () => {
    const cause = new Error('Underlying error');
    const error = new AdapterError({
      code: ErrorCode.PROVIDER_ERROR,
      message: 'Test error',
      isRetryable: true,
      provenance: { frontend: 'test', backend: 'mock' },
      cause,
      irState: { request: { messages: [] } },
      details: { custom: 'data' },
    });

    expect(error.isRetryable).toBe(true);
    expect(error.provenance).toEqual({ frontend: 'test', backend: 'mock' });
    expect(error.cause).toBe(cause);
    expect(error.irState).toEqual({ request: { messages: [] } });
    expect(error.details).toEqual({ custom: 'data' });
  });

  it('should default isRetryable to false', () => {
    const error = new AdapterError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Test',
    });

    expect(error.isRetryable).toBe(false);
  });

  it('should default provenance to empty object', () => {
    const error = new AdapterError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Test',
    });

    expect(error.provenance).toEqual({});
  });

  describe('isCategory()', () => {
    it('should return true for matching category', () => {
      const error = new AdapterError({
        code: ErrorCode.INVALID_API_KEY,
        message: 'Auth error',
      });

      expect(error.isCategory('authentication')).toBe(true);
    });

    it('should return false for non-matching category', () => {
      const error = new AdapterError({
        code: ErrorCode.INVALID_API_KEY,
        message: 'Auth error',
      });

      expect(error.isCategory('network')).toBe(false);
      expect(error.isCategory('validation')).toBe(false);
    });
  });

  describe('toJSON()', () => {
    it('should serialize error to JSON', () => {
      const error = new AdapterError({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Test error',
        isRetryable: true,
        provenance: { frontend: 'test' },
        details: { key: 'value' },
      });

      const json = error.toJSON();

      expect(json.name).toBe('AdapterError');
      expect(json.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(json.message).toBe('Test error');
      expect(json.isRetryable).toBe(true);
      expect(json.provenance).toEqual({ frontend: 'test' });
      expect(json.details).toEqual({ key: 'value' });
      expect(json.timestamp).toBeDefined();
      expect(json.stack).toBeDefined();
    });

    it('should include cause in JSON if present', () => {
      const cause = new Error('Cause error');
      const error = new AdapterError({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Test',
        cause,
      });

      const json = error.toJSON();

      expect(json.cause).toBeDefined();
      expect((json.cause as any).name).toBe('Error');
      expect((json.cause as any).message).toBe('Cause error');
    });

    it('should handle missing cause gracefully', () => {
      const error = new AdapterError({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Test',
      });

      const json = error.toJSON();

      expect(json.cause).toBeUndefined();
    });
  });
});

// ============================================================================
// AuthenticationError Tests
// ============================================================================

describe('AuthenticationError', () => {
  it('should create authentication error', () => {
    const error = new AuthenticationError({
      code: ErrorCode.INVALID_API_KEY,
      message: 'Invalid API key',
    });

    expect(error.name).toBe('AuthenticationError');
    expect(error.code).toBe(ErrorCode.INVALID_API_KEY);
    expect(error.isRetryable).toBe(false); // Authentication errors are not retryable
  });

  it('should override isRetryable to false', () => {
    const error = new AuthenticationError({
      code: ErrorCode.INVALID_API_KEY,
      message: 'Invalid API key',
    });

    expect(error.isRetryable).toBe(false);
  });
});

// ============================================================================
// AuthorizationError Tests
// ============================================================================

describe('AuthorizationError', () => {
  it('should create authorization error', () => {
    const error = new AuthorizationError({
      code: ErrorCode.INSUFFICIENT_PERMISSIONS,
      message: 'Insufficient permissions',
    });

    expect(error.name).toBe('AuthorizationError');
    expect(error.code).toBe(ErrorCode.INSUFFICIENT_PERMISSIONS);
    expect(error.isRetryable).toBe(false);
  });
});

// ============================================================================
// RateLimitError Tests
// ============================================================================

describe('RateLimitError', () => {
  it('should create rate limit error', () => {
    const error = new RateLimitError({
      message: 'Rate limit exceeded',
    });

    expect(error.name).toBe('RateLimitError');
    expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
    expect(error.isRetryable).toBe(true); // Rate limits are retryable
  });

  it('should include rate limit details', () => {
    const error = new RateLimitError({
      message: 'Rate limit exceeded',
      rateLimitDetails: {
        retryAfter: 60,
        limit: 100,
        remaining: 0,
        resetAt: '2024-01-01T00:01:00Z',
      },
    });

    expect(error.retryAfter).toBe(60);
    expect(error.limit).toBe(100);
    expect(error.remaining).toBe(0);
    expect(error.resetAt).toBe('2024-01-01T00:01:00Z');
  });

  it('should handle missing rate limit details', () => {
    const error = new RateLimitError({
      message: 'Rate limit exceeded',
    });

    expect(error.retryAfter).toBeUndefined();
    expect(error.limit).toBeUndefined();
    expect(error.remaining).toBeUndefined();
    expect(error.resetAt).toBeUndefined();
  });
});

// ============================================================================
// ValidationError Tests
// ============================================================================

describe('ValidationError', () => {
  it('should create validation error with details', () => {
    const error = new ValidationError({
      code: ErrorCode.INVALID_REQUEST,
      message: 'Invalid request',
      validationDetails: [
        {
          field: 'temperature',
          value: 5,
          reason: 'Out of range',
          expected: '0 <= temperature <= 2',
        },
      ],
    });

    expect(error.name).toBe('ValidationError');
    expect(error.code).toBe(ErrorCode.INVALID_REQUEST);
    expect(error.isRetryable).toBe(false);
    expect(error.validationDetails).toHaveLength(1);
    expect(error.validationDetails[0].field).toBe('temperature');
    expect(error.validationDetails[0].value).toBe(5);
  });

  it('should handle multiple validation details', () => {
    const error = new ValidationError({
      code: ErrorCode.INVALID_PARAMETERS,
      message: 'Multiple validation errors',
      validationDetails: [
        { field: 'temperature', value: 5, reason: 'Too high' },
        { field: 'maxTokens', value: -1, reason: 'Must be positive' },
      ],
    });

    expect(error.validationDetails).toHaveLength(2);
  });
});

// ============================================================================
// ProviderError Tests
// ============================================================================

describe('ProviderError', () => {
  it('should create provider error', () => {
    const error = new ProviderError({
      code: ErrorCode.PROVIDER_ERROR,
      message: 'Provider returned error',
      isRetryable: true,
    });

    expect(error.name).toBe('ProviderError');
    expect(error.code).toBe(ErrorCode.PROVIDER_ERROR);
  });

  it('should include provider details', () => {
    const error = new ProviderError({
      code: ErrorCode.PROVIDER_ERROR,
      message: 'Provider error',
      providerDetails: {
        provider: 'openai',
        providerCode: 'server_error',
        providerMessage: 'Internal server error',
      },
    });

    expect(error.providerDetails?.provider).toBe('openai');
    expect(error.providerDetails?.providerCode).toBe('server_error');
  });

  it('should include HTTP context', () => {
    const error = new ProviderError({
      code: ErrorCode.PROVIDER_ERROR,
      message: 'HTTP error',
      httpContext: {
        statusCode: 500,
        statusText: 'Internal Server Error',
        responseBody: { error: 'Server error' },
      },
    });

    expect(error.httpContext?.statusCode).toBe(500);
    expect(error.httpContext?.statusText).toBe('Internal Server Error');
  });
});

// ============================================================================
// AdapterConversionError Tests
// ============================================================================

describe('AdapterConversionError', () => {
  it('should create conversion error', () => {
    const error = new AdapterConversionError({
      code: ErrorCode.CONVERSION_FAILED,
      message: 'Failed to convert request',
    });

    expect(error.name).toBe('AdapterConversionError');
    expect(error.code).toBe(ErrorCode.CONVERSION_FAILED);
    expect(error.isRetryable).toBe(false);
  });
});

// ============================================================================
// NetworkError Tests
// ============================================================================

describe('NetworkError', () => {
  it('should create network error', () => {
    const error = new NetworkError({
      code: ErrorCode.NETWORK_ERROR,
      message: 'Connection failed',
    });

    expect(error.name).toBe('NetworkError');
    expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
    expect(error.isRetryable).toBe(true); // Network errors are retryable
  });

  it('should always be retryable', () => {
    const error = new NetworkError({
      code: ErrorCode.TIMEOUT,
      message: 'Request timeout',
    });

    expect(error.isRetryable).toBe(true);
  });
});

// ============================================================================
// StreamError Tests
// ============================================================================

describe('StreamError', () => {
  it('should create stream error', () => {
    const error = new StreamError({
      code: ErrorCode.STREAM_ERROR,
      message: 'Stream failed',
    });

    expect(error.name).toBe('StreamError');
    expect(error.code).toBe(ErrorCode.STREAM_ERROR);
  });

  it('should be retryable for interrupted streams', () => {
    const error = new StreamError({
      code: ErrorCode.STREAM_INTERRUPTED,
      message: 'Stream interrupted',
    });

    expect(error.isRetryable).toBe(true);
  });

  it('should not be retryable for other stream errors', () => {
    const error = new StreamError({
      code: ErrorCode.STREAM_ERROR,
      message: 'Stream failed',
    });

    expect(error.isRetryable).toBe(false);
  });
});

// ============================================================================
// RouterError Tests
// ============================================================================

describe('RouterError', () => {
  it('should create router error', () => {
    const error = new RouterError({
      code: ErrorCode.ROUTING_FAILED,
      message: 'Routing failed',
    });

    expect(error.name).toBe('RouterError');
    expect(error.code).toBe(ErrorCode.ROUTING_FAILED);
  });

  it('should include attempted backends', () => {
    const error = new RouterError({
      code: ErrorCode.ALL_BACKENDS_FAILED,
      message: 'All backends failed',
      attemptedBackends: ['openai', 'anthropic', 'gemini'],
    });

    expect(error.attemptedBackends).toEqual(['openai', 'anthropic', 'gemini']);
    expect(error.isRetryable).toBe(true); // ALL_BACKENDS_FAILED is retryable
  });

  it('should not be retryable for routing failures', () => {
    const error = new RouterError({
      code: ErrorCode.ROUTING_FAILED,
      message: 'No route found',
    });

    expect(error.isRetryable).toBe(false);
  });
});

// ============================================================================
// MiddlewareError Tests
// ============================================================================

describe('MiddlewareError', () => {
  it('should create middleware error', () => {
    const error = new MiddlewareError({
      message: 'Middleware failed',
    });

    expect(error.name).toBe('MiddlewareError');
    expect(error.code).toBe(ErrorCode.MIDDLEWARE_ERROR);
    expect(error.isRetryable).toBe(false);
  });

  it('should include middleware name', () => {
    const error = new MiddlewareError({
      message: 'Logging middleware failed',
      middlewareName: 'logging',
    });

    expect(error.middlewareName).toBe('logging');
  });

  it('should include cause and IR state', () => {
    const cause = new Error('Underlying error');
    const error = new MiddlewareError({
      message: 'Middleware failed',
      cause,
      irState: {
        request: { messages: [{ role: 'user', content: 'test' }] },
      },
    });

    expect(error.cause).toBe(cause);
    expect(error.irState?.request?.messages).toBeDefined();
  });
});

// ============================================================================
// createErrorFromHttpResponse Tests
// ============================================================================

describe('createErrorFromHttpResponse', () => {
  it('should create AuthenticationError for 401', () => {
    const error = createErrorFromHttpResponse(401, 'Unauthorized', {}, { provider: 'test' });

    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error.code).toBe(ErrorCode.INVALID_API_KEY);
  });

  it('should create AuthorizationError for 403', () => {
    const error = createErrorFromHttpResponse(403, 'Forbidden', {}, { provider: 'test' });

    expect(error).toBeInstanceOf(AuthorizationError);
    expect(error.code).toBe(ErrorCode.INSUFFICIENT_PERMISSIONS);
  });

  it('should create RateLimitError for 429', () => {
    const error = createErrorFromHttpResponse(429, 'Too Many Requests', {}, { provider: 'test' });

    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
  });

  it('should create ValidationError for 400', () => {
    const error = createErrorFromHttpResponse(400, 'Bad Request', {}, { provider: 'test' });

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.code).toBe(ErrorCode.INVALID_REQUEST);
  });

  it('should create ProviderError for 5xx', () => {
    const error = createErrorFromHttpResponse(500, 'Internal Server Error', {}, { provider: 'test' });

    expect(error).toBeInstanceOf(ProviderError);
    expect(error.code).toBe(ErrorCode.PROVIDER_ERROR);
    expect(error.isRetryable).toBe(true);
  });

  it('should create generic AdapterError for other status codes', () => {
    const error = createErrorFromHttpResponse(418, "I'm a teapot", {}, { provider: 'test' });

    expect(error).toBeInstanceOf(AdapterError);
    expect(error.code).toBe(ErrorCode.PROVIDER_ERROR);
  });

  it('should include status code in message', () => {
    const error = createErrorFromHttpResponse(418, "I'm a teapot", {}, { provider: 'test' });

    expect(error.message).toContain('418');
  });
});

// ============================================================================
// createErrorFromProviderError Tests
// ============================================================================

describe('createErrorFromProviderError', () => {
  it('should create ProviderError from provider-specific error', () => {
    const providerError = { code: 'invalid_model', message: 'Model not found' };
    const error = createErrorFromProviderError('openai', providerError, { provider: 'openai' });

    expect(error).toBeInstanceOf(ProviderError);
    expect(error.code).toBe(ErrorCode.PROVIDER_ERROR);
  });

  it('should include provider name in details', () => {
    const providerError = new Error('Test error');
    const error = createErrorFromProviderError('anthropic', providerError, { provider: 'anthropic' });

    const pe = error as ProviderError;
    expect(pe.providerDetails?.provider).toBe('anthropic');
  });

  it('should handle string errors', () => {
    const error = createErrorFromProviderError('gemini', 'String error', { provider: 'gemini' });

    const pe = error as ProviderError;
    expect(pe.providerDetails?.providerMessage).toBe('String error');
  });
});

// ============================================================================
// Error Inheritance Tests
// ============================================================================

describe('Error Inheritance', () => {
  it('should be catchable as Error', () => {
    const error = new AdapterError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Test',
    });

    expect(error instanceof Error).toBe(true);
  });

  it('should be catchable as AdapterError', () => {
    const error = new ValidationError({
      code: ErrorCode.INVALID_REQUEST,
      message: 'Test',
      validationDetails: [],
    });

    expect(error instanceof AdapterError).toBe(true);
  });

  it('should have proper prototype chain', () => {
    const error = new RateLimitError({ message: 'Test' });

    expect(Object.getPrototypeOf(error).constructor.name).toBe('RateLimitError');
    expect(Object.getPrototypeOf(Object.getPrototypeOf(error)).constructor.name).toBe('AdapterError');
  });

  it('should have stack trace', () => {
    const error = new AdapterError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Test',
    });

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('AdapterError');
  });
});
