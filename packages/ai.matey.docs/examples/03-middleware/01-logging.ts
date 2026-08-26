/**
 * Logging Middleware - Request/Response Tracking
 *
 * Demonstrates:
 * - Adding logging middleware to track all requests and responses
 * - Configuring log levels (debug, info, warn, error)
 * - Redacting sensitive information (API keys)
 * - Using logging for debugging and monitoring
 *
 * Prerequisites:
 * - ANTHROPIC_API_KEY environment variable set
 * - @johnhenry/aimatey-middleware package installed
 *
 * Run:
 *   npx tsx packages/ai.matey.docs/examples/03-middleware/01-logging.ts
 *
 * Expected Output:
 *   Detailed logs of the request/response cycle, with sensitive
 *   data automatically redacted.
 */

import { Bridge } from '@johnhenry/aimatey-core';
import { OpenAIFrontendAdapter } from '@johnhenry/aimatey-frontend/openai';
import { AnthropicBackendAdapter } from '@johnhenry/aimatey-backend/anthropic';
import { createLoggingMiddleware } from '@johnhenry/aimatey-middleware';
import { requireAPIKey } from '../_shared/env-loader.js';
import { displayExampleInfo, displayError } from '../_shared/helpers.js';

async function main() {
  displayExampleInfo(
    'Logging Middleware',
    'Track all AI requests and responses with automatic logging',
    [
      'ANTHROPIC_API_KEY environment variable',
      '@johnhenry/aimatey-middleware package installed'
    ]
  );

  try {
    const anthropicKey = requireAPIKey('anthropic');

    // Create bridge
    const bridge = new Bridge(
      new OpenAIFrontendAdapter(),
      new AnthropicBackendAdapter({ apiKey: anthropicKey })
    );

    // Add logging middleware with configuration
    console.log('📋 Configuring logging middleware...\n');

    bridge.use(
      createLoggingMiddleware({
        level: 'info',               // Log level: debug, info, warn, error
        logRequests: true,           // Log outgoing requests
        logResponses: true,          // Log incoming responses
        logErrors: true,             // Log errors
        redactFields: [              // Fields to redact (for security)
          'apiKey',
          'api_key',
          'authorization',
          'Authorization'
        ],
      })
    );

    console.log('✓ Logging middleware configured');
    console.log('  - Level: info');
    console.log('  - Redacting: apiKey, authorization');
    console.log('  - Timestamps: enabled\n');

    console.log('═'.repeat(60));
    console.log('Making request (watch the logs below)...');
    console.log('═'.repeat(60) + '\n');

    // Make a request - logging middleware will automatically log it
    const response = await bridge.chat({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: 'Explain the importance of logging in software systems in 2 sentences.',
        },
      ],
      temperature: 0.7,
      max_tokens: 100
    });

    console.log('\n' + '═'.repeat(60));
    console.log('Request completed!');
    console.log('═'.repeat(60) + '\n');

    console.log('📝 Response:');
    console.log('─'.repeat(60));
    console.log(response.choices[0].message.content);
    console.log('─'.repeat(60) + '\n');

    if (response.usage) {
      console.log('📊 Token Usage:');
      console.log(`   Prompt: ${response.usage.prompt_tokens}`);
      console.log(`   Completion: ${response.usage.completion_tokens}`);
      console.log(`   Total: ${response.usage.total_tokens}\n`);
    }

    console.log('💡 Benefits of Logging Middleware:');
    console.log('   ✓ Automatic tracking of all requests');
    console.log('   ✓ Sensitive data automatically redacted');
    console.log('   ✓ Easy debugging of API issues');
    console.log('   ✓ Monitoring of token usage and costs');
    console.log('   ✓ Audit trail for compliance');
    console.log('   ✓ Zero code changes to existing requests\n');

    console.log('🔧 Advanced Configuration Options:');
    console.log('   • level: "debug" | "info" | "warn" | "error"');
    console.log('   • format: custom log formatting function');
    console.log('   • destination: console, file, or custom logger');
    console.log('   • filter: only log specific requests');
    console.log('   • includeHeaders: log HTTP headers\n');

  } catch (error) {
    displayError(error, 'Logging middleware example');
    process.exit(1);
  }
}

main();
