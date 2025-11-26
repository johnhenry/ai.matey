/**
 * Error Handling Example - Using Error Package
 *
 * Shows how to use the dedicated error package for
 * proper error handling across providers.
 */

// Core imports
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';

// Error imports - dedicated package for error types
import {
  AdapterError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  ProviderError,
  NetworkError,
  ErrorCode,
  createErrorFromHttpResponse,
} from 'ai.matey.errors';

async function main() {
  console.log('=== Error Handling Examples ===\n');

  // Example 1: Catching specific error types
  console.log('1. Catching specific error types:');
  await specificErrorHandling();

  // Example 2: Error factory functions
  console.log('\n2. Creating errors from HTTP responses:');
  errorFactoryExample();

  // Example 3: Error codes
  console.log('\n3. Using error codes:');
  errorCodeExample();
}

async function specificErrorHandling() {
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new AnthropicBackendAdapter({
      apiKey: 'invalid-api-key', // This will cause an auth error
    })
  );

  try {
    await bridge.chat({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello!' }],
    });
  } catch (error) {
    // Handle specific error types
    if (error instanceof AuthenticationError) {
      console.log('  Authentication failed:', error.message);
      console.log('  Suggestion: Check your API key');
    } else if (error instanceof RateLimitError) {
      console.log('  Rate limited:', error.message);
      console.log('  Retry after:', error.retryAfter, 'seconds');
    } else if (error instanceof ValidationError) {
      console.log('  Invalid request:', error.message);
      console.log('  Validation errors:', error.details);
    } else if (error instanceof NetworkError) {
      console.log('  Network error:', error.message);
      console.log('  Suggestion: Check your internet connection');
    } else if (error instanceof ProviderError) {
      console.log('  Provider error:', error.message);
      console.log('  Provider:', error.provider);
    } else if (error instanceof AdapterError) {
      console.log('  Adapter error:', error.message);
      console.log('  Error code:', error.code);
    } else {
      console.log('  Unknown error:', error);
    }
  }
}

function errorFactoryExample() {
  // Create errors from HTTP responses (useful for custom HTTP clients)
  const notFoundError = createErrorFromHttpResponse(
    404,
    { error: { message: 'Model not found' } },
    { provider: 'openai', endpoint: '/v1/chat/completions' }
  );
  console.log('  404 error:', notFoundError.constructor.name, '-', notFoundError.message);

  const rateLimitError = createErrorFromHttpResponse(
    429,
    {
      error: { message: 'Rate limit exceeded' },
      retry_after: 30,
    },
    { provider: 'openai' }
  );
  console.log('  429 error:', rateLimitError.constructor.name, '-', rateLimitError.message);

  const serverError = createErrorFromHttpResponse(
    500,
    { error: { message: 'Internal server error' } },
    { provider: 'anthropic' }
  );
  console.log('  500 error:', serverError.constructor.name, '-', serverError.message);
}

function errorCodeExample() {
  // Error codes provide machine-readable error classification
  console.log('  Available error codes:');
  console.log('  - AUTHENTICATION_ERROR:', ErrorCode.AUTHENTICATION_ERROR);
  console.log('  - RATE_LIMIT_ERROR:', ErrorCode.RATE_LIMIT_ERROR);
  console.log('  - VALIDATION_ERROR:', ErrorCode.VALIDATION_ERROR);
  console.log('  - PROVIDER_ERROR:', ErrorCode.PROVIDER_ERROR);
  console.log('  - NETWORK_ERROR:', ErrorCode.NETWORK_ERROR);
  console.log('  - TIMEOUT_ERROR:', ErrorCode.TIMEOUT_ERROR);

  // Use error codes in switch statements
  const error = new RateLimitError('Too many requests', { retryAfter: 60 });

  switch (error.code) {
    case ErrorCode.RATE_LIMIT_ERROR:
      console.log('\n  Handling rate limit: wait and retry');
      break;
    case ErrorCode.AUTHENTICATION_ERROR:
      console.log('\n  Handling auth error: check credentials');
      break;
    default:
      console.log('\n  Handling generic error');
  }
}

main().catch(console.error);
