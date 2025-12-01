/**
 * Middleware Stack - Composing Multiple Middleware
 *
 * Demonstrates:
 * - Combining multiple middleware in a single bridge
 * - Understanding middleware execution order
 * - Building a production-ready middleware stack
 * - Middleware interaction and composition
 * - Best practices for middleware ordering
 *
 * Prerequisites:
 * - ANTHROPIC_API_KEY environment variable set
 * - ai.matey.middleware package installed
 *
 * Run:
 *   npx tsx examples/03-middleware/06-middleware-stack.ts
 *
 * Expected Output:
 *   Multiple requests demonstrating how middleware layers work together:
 *   logging, retry, caching, and transformation all working in harmony.
 */

import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
import {
  createLoggingMiddleware,
  createRetryMiddleware,
  createCachingMiddleware,
  createTransformMiddleware,
} from 'ai.matey.middleware';
import type { IRChatCompletionRequest } from 'ai.matey.types';
import { requireAPIKey } from '../_shared/env-loader.js';
import { displayExampleInfo, displayError } from '../_shared/helpers.js';

async function main() {
  displayExampleInfo(
    'Middleware Stack',
    'Compose multiple middleware for production-ready AI bridges',
    [
      'ANTHROPIC_API_KEY environment variable',
      'ai.matey.middleware package installed'
    ]
  );

  try {
    const anthropicKey = requireAPIKey('anthropic');

    // Create the base bridge
    const bridge = new Bridge(
      new OpenAIFrontendAdapter(),
      new AnthropicBackendAdapter({ apiKey: anthropicKey })
    );

    console.log('🏗️  Building middleware stack...\n');

    // Layer 1: Logging (outermost - sees everything)
    console.log('📋 Layer 1: Logging Middleware');
    bridge.use(
      createLoggingMiddleware({
        level: 'info',
        logRequests: true,
        logResponses: true,
        logErrors: true,
        includeTimestamps: true,
        redactFields: ['apiKey', 'api_key', 'authorization'],
      })
    );

    // Layer 2: Retry (handles failures before they propagate)
    console.log('🔄 Layer 2: Retry Middleware');
    bridge.use(
      createRetryMiddleware({
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
      })
    );

    // Layer 3: Caching (avoids unnecessary retries and API calls)
    console.log('💾 Layer 3: Caching Middleware');
    bridge.use(
      createCachingMiddleware({
        ttl: 60,    // 1 minute cache
        maxSize: 100,
        keyGenerator: (request) => {
          return JSON.stringify({
            model: request.model,
            messages: request.messages,
          });
        },
      })
    );

    // Layer 4: Transform (innermost - modifies requests/responses)
    console.log('🔧 Layer 4: Transform Middleware');
    bridge.use(
      createTransformMiddleware({
        transformRequest: (request: IRChatCompletionRequest) => ({
          ...request,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant. Keep responses concise and clear.',
            },
            ...request.messages,
          ],
        }),
      })
    );

    console.log('\n✓ Middleware stack built!\n');

    // Visualize the stack
    console.log('📊 Middleware Execution Order:');
    console.log('─'.repeat(60));
    console.log('Request Flow (top to bottom):');
    console.log('  1. Logging (log request)');
    console.log('  2. Retry (check cache)');
    console.log('  3. Caching (check cache)');
    console.log('  4. Transform (modify request)');
    console.log('  5. → Backend API Call');
    console.log('  6. Transform (modify response)');
    console.log('  7. Caching (store in cache)');
    console.log('  8. Retry (handle success)');
    console.log('  9. Logging (log response)');
    console.log('─'.repeat(60) + '\n');

    console.log('═'.repeat(60));
    console.log('Testing middleware stack with multiple requests...');
    console.log('═'.repeat(60) + '\n');

    // Request 1: Will be processed and cached
    console.log('📝 Request 1: "What is 2 + 2?" (cache MISS)');
    console.log('─'.repeat(60) + '\n');

    const start1 = Date.now();
    const response1 = await bridge.chat({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: 'What is 2 + 2?',
        },
      ],
      max_tokens: 50
    });
    const duration1 = Date.now() - start1;

    console.log('Response:', response1.choices[0].message.content);
    console.log(`Duration: ${duration1}ms\n`);

    // Request 2: Identical - will hit cache
    console.log('📝 Request 2: "What is 2 + 2?" (cache HIT)');
    console.log('─'.repeat(60) + '\n');

    const start2 = Date.now();
    const response2 = await bridge.chat({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: 'What is 2 + 2?',
        },
      ],
      max_tokens: 50
    });
    const duration2 = Date.now() - start2;

    console.log('Response:', response2.choices[0].message.content);
    console.log(`Duration: ${duration2}ms (${(duration1 / duration2).toFixed(1)}x faster!)\n`);

    // Request 3: Different question
    console.log('📝 Request 3: Different question (cache MISS)');
    console.log('─'.repeat(60) + '\n');

    const start3 = Date.now();
    const response3 = await bridge.chat({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: 'What is the square root of 16?',
        },
      ],
      max_tokens: 50
    });
    const duration3 = Date.now() - start3;

    console.log('Response:', response3.choices[0].message.content);
    console.log(`Duration: ${duration3}ms\n`);

    console.log('═'.repeat(60));
    console.log('Stack Performance Summary');
    console.log('═'.repeat(60));
    console.log(`Request 1 (API call):    ${duration1}ms`);
    console.log(`Request 2 (cached):      ${duration2}ms`);
    console.log(`Request 3 (API call):    ${duration3}ms`);
    console.log(`Cache speedup:           ${(duration1 / duration2).toFixed(1)}x\n`);

    console.log('💡 Benefits of Middleware Stacks:');
    console.log('   ✓ Separation of concerns (each middleware has one job)');
    console.log('   ✓ Reusable components across projects');
    console.log('   ✓ Easy to add/remove functionality');
    console.log('   ✓ Testable in isolation');
    console.log('   ✓ Production-ready error handling');
    console.log('   ✓ Composable and maintainable\n');

    console.log('🔧 Middleware Ordering Best Practices:');
    console.log('   1. Logging (outermost) - see everything');
    console.log('   2. Retry - handle failures early');
    console.log('   3. Caching - avoid unnecessary work');
    console.log('   4. Transform - closest to the data');
    console.log('   5. Backend adapter (innermost)\n');

    console.log('⚠️  Common Pitfalls:');
    console.log('   • Wrong order: caching before transform won\'t cache transformed requests');
    console.log('   • Missing logging: hard to debug without visibility');
    console.log('   • No retry: transient failures become permanent');
    console.log('   • Over-middleware: keep it simple, only add what you need\n');

    console.log('🎯 Production Stack Recommendations:');
    console.log('   Essential: Logging + Retry');
    console.log('   High-traffic: Add Caching');
    console.log('   Multi-tenant: Add Cost Tracking');
    console.log('   Custom behavior: Add Transform\n');

  } catch (error) {
    displayError(error, 'Middleware stack example');
    process.exit(1);
  }
}

main();
