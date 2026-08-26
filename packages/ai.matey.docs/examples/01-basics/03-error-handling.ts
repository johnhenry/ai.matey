/**
 * Error Handling - Graceful Failure Management
 *
 * Demonstrates:
 * - Proper error handling with try/catch
 * - Checking for specific error types
 * - Providing helpful error messages to users
 * - Graceful degradation strategies
 *
 * Prerequisites:
 * - ANTHROPIC_API_KEY environment variable set (or intentionally wrong for testing)
 * - Basic understanding of async/await and error handling
 *
 * Run:
 *   npx tsx packages/ai.matey.docs/examples/01-basics/03-error-handling.ts
 *
 * Expected Output:
 *   Demonstrates both successful requests and proper error handling
 *   when things go wrong (invalid API key, network issues, etc.)
 */

import { Bridge } from '@johnhenry/aimatey-core';
import { OpenAIFrontendAdapter } from '@johnhenry/aimatey-frontend/openai';
import { AnthropicBackendAdapter } from '@johnhenry/aimatey-backend/anthropic';
import { displayExampleInfo, displayResponse, displayError } from '../_shared/helpers.js';

async function main() {
  displayExampleInfo(
    'Error Handling',
    'Learn proper error handling patterns for AI requests',
    [
      'ANTHROPIC_API_KEY environment variable (can be intentionally wrong for testing)',
      'Understanding of try/catch and error handling'
    ]
  );

  // Example 1: Handling invalid API key
  console.log('\n📝 Example 1: Invalid API Key');
  console.log('─'.repeat(60));

  try {
    const bridge = new Bridge(
      new OpenAIFrontendAdapter(),
      new AnthropicBackendAdapter({
        apiKey: 'sk-ant-invalid-key' // Intentionally invalid
      })
    );

    await bridge.chat({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello!' }]
    });

  } catch (error) {
    // Check if it's an authentication error
    if (error instanceof Error && error.message.includes('401')) {
      console.log('✗ Authentication failed: Invalid API key');
      console.log('💡 Solution: Check your ANTHROPIC_API_KEY environment variable\n');
    } else {
      displayError(error, 'API request');
    }
  }

  // Example 2: Handling rate limits
  console.log('\n📝 Example 2: Rate Limit Handling');
  console.log('─'.repeat(60));

  try {
    // Simulating rate limit by making rapid requests
    // (In real scenario, you'd catch 429 errors)

    console.log('💡 In production, use retry middleware for rate limits');
    console.log('   import { createRetryMiddleware } from "@johnhenry/aimatey-middleware"');
    console.log('   bridge.use(createRetryMiddleware({ maxAttempts: 3 }))\n');

  } catch (error) {
    if (error instanceof Error && error.message.includes('429')) {
      console.log('✗ Rate limit exceeded');
      console.log('💡 Solution: Wait before retrying or use retry middleware\n');
    }
  }

  // Example 3: Successful request with proper error handling
  console.log('\n📝 Example 3: Successful Request (with error handling)');
  console.log('─'.repeat(60));

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY environment variable is not set.\n' +
        'Set it with: export ANTHROPIC_API_KEY=your-key-here'
      );
    }

    const bridge = new Bridge(
      new OpenAIFrontendAdapter(),
      new AnthropicBackendAdapter({ apiKey })
    );

    console.log('Making request...\n');

    const response = await bridge.chat({
      model: 'gpt-4',
      messages: [
        { role: 'user', content: 'Say "Hello from ai.matey!"' }
      ],
      max_tokens: 50
    });

    displayResponse(response, 'Success!');

  } catch (error) {
    displayError(error, 'Example 3');
  }

  // Example 4: Graceful degradation
  console.log('\n📝 Example 4: Graceful Degradation');
  console.log('─'.repeat(60));

  const primaryKey = process.env.ANTHROPIC_API_KEY;
  const backupKey = process.env.OPENAI_API_KEY;

  if (!primaryKey && !backupKey) {
    console.log('✗ No API keys available');
    console.log('💡 Set either ANTHROPIC_API_KEY or OPENAI_API_KEY\n');
    return;
  }

  try {
    // Try primary backend
    if (primaryKey) {
      console.log('Trying primary backend (Anthropic)...');
      const bridge = new Bridge(
        new OpenAIFrontendAdapter(),
        new AnthropicBackendAdapter({ apiKey: primaryKey })
      );

      const response = await bridge.chat({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Primary backend test' }],
        max_tokens: 20
      });

      console.log('✓ Primary backend successful\n');
    }
  } catch (primaryError) {
    console.log('✗ Primary backend failed');

    // Fall back to secondary backend
    if (backupKey) {
      console.log('Falling back to secondary backend (OpenAI)...');

      try {
        const { OpenAIBackendAdapter } = await import('@johnhenry/aimatey-backend/openai');
        const bridge = new Bridge(
          new OpenAIFrontendAdapter(),
          new OpenAIBackendAdapter({ apiKey: backupKey })
        );

        const response = await bridge.chat({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Backup backend test' }],
          max_tokens: 20
        });

        console.log('✓ Backup backend successful\n');
      } catch (backupError) {
        console.log('✗ Both backends failed');
        displayError(backupError, 'backup backend');
      }
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  Key Takeaways');
  console.log('═'.repeat(60));
  console.log('✓ Always use try/catch for AI API calls');
  console.log('✓ Check for specific error types (401, 429, etc.)');
  console.log('✓ Provide helpful error messages');
  console.log('✓ Consider graceful degradation strategies');
  console.log('✓ Use middleware for automatic retry logic\n');
}

main();
