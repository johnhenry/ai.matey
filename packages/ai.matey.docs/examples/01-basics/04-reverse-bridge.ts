/**
 * Reverse Bridge - Swap Frontend and Backend
 *
 * Demonstrates:
 * - Using Anthropic format with OpenAI backend
 * - The flexibility of the Bridge pattern
 * - Why you might want to "reverse" the typical setup
 * - Frontend/backend adapter independence
 *
 * Prerequisites:
 * - OPENAI_API_KEY environment variable set
 * - Understanding of Bridge pattern
 *
 * Run:
 *   npx tsx examples/01-basics/04-reverse-bridge.ts
 *
 * Expected Output:
 *   Response from OpenAI (GPT) using Anthropic's API format,
 *   demonstrating that you can use any frontend with any backend.
 */

import { Bridge } from 'ai.matey.core';
import { AnthropicFrontendAdapter } from 'ai.matey.frontend/anthropic';
import { OpenAIBackendAdapter } from 'ai.matey.backend/openai';
import { requireAPIKey } from '../_shared/env-loader.js';
import { displayExampleInfo, displayResponse, displayError } from '../_shared/helpers.js';

async function main() {
  displayExampleInfo(
    'Reverse Bridge - Anthropic Format → OpenAI Backend',
    'Use Anthropic\'s API format but execute on OpenAI\'s models',
    [
      'OPENAI_API_KEY environment variable',
      'Understanding of the Bridge pattern'
    ]
  );

  try {
    const openaiKey = requireAPIKey('openai');

    // Create a "reverse" bridge:
    // - Frontend: Anthropic format (accept Anthropic-style requests)
    // - Backend: OpenAI execution (run on OpenAI models)
    console.log('🔄 Creating reverse bridge...');
    console.log('   Frontend: Anthropic format');
    console.log('   Backend: OpenAI models\n');

    const bridge = new Bridge(
      new AnthropicFrontendAdapter(),
      new OpenAIBackendAdapter({ apiKey: openaiKey })
    );

    // Why would you do this?
    console.log('💡 Use Cases for Reverse Bridge:');
    console.log('   • You prefer Anthropic\'s API format but want to use OpenAI models');
    console.log('   • You\'re migrating from Anthropic to OpenAI but don\'t want to rewrite code');
    console.log('   • You\'re building a tool that accepts Anthropic format for consistency');
    console.log('   • You want to test the same code against different backends\n');

    console.log('📝 Making request in Anthropic format...\n');

    // Make a request using Anthropic's API format
    // Notice the Anthropic-specific fields like max_tokens (not max_tokens)
    const response = await bridge.chat({
      model: 'claude-3-5-sonnet-20241022', // Will be mapped to a GPT model
      max_tokens: 150, // Anthropic uses max_tokens, not max_tokens
      messages: [
        {
          role: 'user',
          content: 'Explain in one sentence why adapter patterns are useful in software design.',
        },
      ],
      temperature: 0.7,
    });

    displayResponse(response, 'OpenAI Response (via Anthropic format)');

    console.log('✅ Success!');
    console.log('   You just used Anthropic\'s API format to call OpenAI!\n');

    console.log('🔍 Behind the Scenes:');
    console.log('   1. Your code used Anthropic format (max_tokens, etc.)');
    console.log('   2. AnthropicFrontendAdapter parsed it into IR format');
    console.log('   3. OpenAIBackendAdapter converted IR to OpenAI format');
    console.log('   4. Request executed on OpenAI (GPT models)');
    console.log('   5. Response converted back through the pipeline\n');

    console.log('💡 Key Insight:');
    console.log('   Frontends and backends are completely independent!');
    console.log('   You can mix and match any frontend with any backend.\n');

    // Comparison table
    console.log('📊 Format Comparison:');
    console.log('─'.repeat(60));
    console.log('Anthropic Format        →  OpenAI Format');
    console.log('─'.repeat(60));
    console.log('max_tokens             →  max_tokens');
    console.log('claude-3-5-sonnet      →  gpt-4');
    console.log('model-specific options  →  model-specific options');
    console.log('─'.repeat(60) + '\n');

  } catch (error) {
    displayError(error, 'Reverse Bridge example');
    process.exit(1);
  }
}

main();
