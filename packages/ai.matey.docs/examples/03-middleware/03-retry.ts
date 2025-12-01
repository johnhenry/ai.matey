/**
 * Retry Middleware - Automatic Failure Recovery
 *
 * Demonstrates:
 * - Adding retry logic for transient failures
 * - Configuring exponential backoff strategy
 * - Selective retry based on error types
 * - Rate limit and network error handling
 * - Retry attempt logging and monitoring
 *
 * Prerequisites:
 * - ANTHROPIC_API_KEY environment variable set
 * - ai.matey.middleware package installed
 *
 * Run:
 *   npx tsx examples/03-middleware/03-retry.ts
 *
 * Expected Output:
 *   Request succeeds with automatic retry on transient failures.
 *   Retry attempts are logged with backoff timing.
 */

import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
import { createRetryMiddleware } from 'ai.matey.middleware';
import { requireAPIKey } from '../_shared/env-loader.js';
import { displayExampleInfo, displayResponse, displayError } from '../_shared/helpers.js';

async function main() {
  displayExampleInfo(
    'Retry Middleware',
    'Automatically retry failed requests with exponential backoff',
    [
      'ANTHROPIC_API_KEY environment variable',
      'ai.matey.middleware package installed'
    ]
  );

  try {
    const anthropicKey = requireAPIKey('anthropic');

    // Create bridge
    const bridge = new Bridge(
      new OpenAIFrontendAdapter(),
      new AnthropicBackendAdapter({ apiKey: anthropicKey })
    );

    // Add retry middleware with configuration
    console.log('🔄 Configuring retry middleware...\n');

    bridge.use(
      createRetryMiddleware({
        maxAttempts: 3,              // Retry up to 3 times
        initialDelay: 1000,          // Start with 1 second delay
        maxDelay: 10000,             // Cap delay at 10 seconds
        backoffMultiplier: 2,        // Double delay each retry (exponential backoff)
        shouldRetry: (error, attempt) => {
          // Only retry on specific error types
          const isRateLimit = error.message?.includes('429') || error.message?.includes('rate limit');
          const isNetwork = error.message?.includes('ECONNRESET') || error.message?.includes('ETIMEDOUT');
          const isServerError = error.message?.includes('500') || error.message?.includes('503');

          if (isRateLimit || isNetwork || isServerError) {
            console.log(`   ⚠️  Retryable error detected (attempt ${attempt}): ${error.message}`);
            return true;
          }

          console.log(`   ✗ Non-retryable error: ${error.message}`);
          return false;
        },
        onRetry: (error, attempt, delay) => {
          console.log(`   🔄 Retrying in ${delay}ms (attempt ${attempt})...`);
        },
      })
    );

    console.log('✓ Retry middleware configured');
    console.log('  - Max attempts: 3');
    console.log('  - Initial delay: 1000ms');
    console.log('  - Backoff: exponential (2x)');
    console.log('  - Retry on: rate limits, network errors, server errors\n');

    console.log('═'.repeat(60));
    console.log('Making request (will auto-retry on transient failures)...');
    console.log('═'.repeat(60) + '\n');

    const response = await bridge.chat({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: 'Explain exponential backoff in 2 sentences.',
        },
      ],
      temperature: 0.7,
      max_tokens: 100
    });

    displayResponse(response, 'Success (with retry protection)');

    console.log('💡 Benefits of Retry Middleware:');
    console.log('   ✓ Automatic recovery from transient failures');
    console.log('   ✓ Handles rate limits gracefully');
    console.log('   ✓ Improves reliability without code changes');
    console.log('   ✓ Exponential backoff prevents API hammering');
    console.log('   ✓ Selective retry based on error type');
    console.log('   ✓ Configurable retry strategies\n');

    console.log('🔧 Advanced Configuration Options:');
    console.log('   • jitter: add randomness to prevent thundering herd');
    console.log('   • timeout: per-request timeout before retry');
    console.log('   • onMaxRetriesExceeded: custom handler when all retries fail');
    console.log('   • retryableStatusCodes: specific HTTP codes to retry');
    console.log('   • customBackoff: linear, exponential, or custom strategy\n');

    console.log('📊 Retry Strategy Examples:');
    console.log('─'.repeat(60));
    console.log('Attempt  Delay (exponential 2x)  Total Wait');
    console.log('─'.repeat(60));
    console.log('1        0ms                      0ms');
    console.log('2        1000ms                   1000ms');
    console.log('3        2000ms                   3000ms');
    console.log('4        4000ms                   7000ms');
    console.log('─'.repeat(60) + '\n');

    console.log('⚠️  Best Practices:');
    console.log('   • Only retry idempotent operations');
    console.log('   • Don\'t retry on authentication errors (401)');
    console.log('   • Use jitter to avoid synchronized retries');
    console.log('   • Set reasonable max attempts (3-5)');
    console.log('   • Monitor retry rates for issues\n');

  } catch (error) {
    displayError(error, 'Retry middleware example');
    process.exit(1);
  }
}

main();
