/**
 * Middleware Stack Example - Composing Multiple Middleware Packages
 *
 * Shows how to combine middleware from different packages:
 * - Logging middleware
 * - Retry middleware
 * - Caching middleware
 * - Transform middleware
 */

// Core imports
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';

// Middleware imports - each from its own package
import { createLoggingMiddleware } from 'ai.matey.middleware';
import { createRetryMiddleware } from 'ai.matey.middleware';
import { createCachingMiddleware } from 'ai.matey.middleware';
import { createTransformMiddleware } from 'ai.matey.middleware';

async function main() {
  // Create the base bridge
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    })
  );

  // Add logging middleware (runs first and last)
  bridge.use(
    createLoggingMiddleware({
      level: 'info',
      logRequests: true,
      logResponses: true,
      logErrors: true,
      redactFields: ['apiKey', 'api_key', 'authorization'],
    })
  );

  // Add retry middleware (handles transient failures)
  bridge.use(
    createRetryMiddleware({
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
      retryableErrors: ['RATE_LIMIT', 'NETWORK_ERROR', 'TIMEOUT'],
    })
  );

  // Add caching middleware (avoid duplicate requests)
  bridge.use(
    createCachingMiddleware({
      maxSize: 100,
      ttlMs: 60000, // 1 minute cache
      keyGenerator: (request) => {
        // Cache based on model and message content
        return JSON.stringify({
          model: request.model,
          messages: request.messages,
        });
      },
    })
  );

  // Add transform middleware (modify requests/responses)
  bridge.use(
    createTransformMiddleware({
      transformRequest: (request) => ({
        ...request,
        // Add system prompt to all requests
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant. Keep responses concise.',
          },
          ...request.messages,
        ],
      }),
      transformResponse: (response) => ({
        ...response,
        // Add custom metadata
        _meta: {
          processedAt: new Date().toISOString(),
          middleware: 'transform',
        },
      }),
    })
  );

  console.log('Making requests with full middleware stack...\n');

  // First request - will be processed and cached
  console.log('Request 1 (will be cached):');
  const response1 = await bridge.chat({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'What is 2 + 2?',
      },
    ],
  });
  console.log('Response:', response1.choices[0].message.content);

  // Second identical request - will hit cache
  console.log('\nRequest 2 (cache hit):');
  const response2 = await bridge.chat({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'What is 2 + 2?',
      },
    ],
  });
  console.log('Response:', response2.choices[0].message.content);

  // Different request - will not hit cache
  console.log('\nRequest 3 (different question):');
  const response3 = await bridge.chat({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'What is the square root of 16?',
      },
    ],
  });
  console.log('Response:', response3.choices[0].message.content);
}

main().catch(console.error);
