/**
 * Anthropic SDK Wrapper - Drop-in Claude Replacement
 *
 * Demonstrates:
 * - Using Anthropic SDK syntax with any backend
 * - Zero code changes for existing Anthropic SDK users
 * - Seamless Claude migration
 * - SDK-compatible streaming
 * - Automatic format conversion
 *
 * Prerequisites:
 * - OPENAI_API_KEY in web.env.local.mjs (or any other provider)
 * - ai.matey.wrapper package installed
 *
 * Run:
 *   npx tsx examples/06-sdk-wrappers/02-anthropic-sdk.ts
 *
 * Expected Output:
 *   Anthropic SDK code running on OpenAI (or any other) backend,
 *   demonstrating provider-agnostic development.
 */

import { Anthropic } from 'ai.matey.wrapper/anthropic';
import { Bridge } from 'ai.matey.core';
import { AnthropicFrontendAdapter } from 'ai.matey.frontend/anthropic';
import { OpenAIBackendAdapter } from 'ai.matey.backend/openai';
import { createLoggingMiddleware } from 'ai.matey.middleware';
import { requireAPIKey } from '../_shared/env-loader.js';
import { displayExampleInfo, displayError } from '../_shared/helpers.js';

async function main() {
  displayExampleInfo(
    'Anthropic SDK Wrapper',
    'Use Anthropic SDK syntax with any AI provider',
    [
      'OPENAI_API_KEY (or any provider key) in web.env.local.mjs',
      'npm install ai.matey.wrapper'
    ]
  );

  try {
    const openaiKey = requireAPIKey('openai');

    // Create bridge with OpenAI backend
    const bridge = new Bridge(
      new AnthropicFrontendAdapter(),
      new OpenAIBackendAdapter({ apiKey: openaiKey })
    );

    // Add middleware
    bridge.use(
      createLoggingMiddleware({
        level: 'info',
        logRequests: false,
        logResponses: false,
      })
    );

    // Create Anthropic SDK-compatible client
    // Existing Anthropic SDK code works without changes!
    const client = new Anthropic({
      bridge, // Magic: routes through ai.matey
      apiKey: 'unused', // Not needed - bridge handles auth
    });

    console.log('\n💡 Using Anthropic SDK syntax with OpenAI backend\n');

    // Example 1: Basic Message Creation
    console.log('═'.repeat(60));
    console.log('Example 1: Standard Message Creation');
    console.log('═'.repeat(60) + '\n');

    // This looks like Anthropic SDK code...
    const message1 = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022', // Requested as Claude
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: 'Explain the adapter pattern in software design in 2 sentences.',
        },
      ],
    });

    console.log('Request: "Explain the adapter pattern..."');
    console.log('Model: claude-3-5-sonnet (maps to gpt-4)');
    console.log('Backend: OpenAI\n');

    console.log('Response:');
    console.log('─'.repeat(60));
    // Anthropic SDK returns content as array
    console.log(message1.content[0].text);
    console.log('─'.repeat(60) + '\n');

    if (message1.usage) {
      console.log('Usage:');
      console.log(`  Input tokens: ${message1.usage.input_tokens}`);
      console.log(`  Output tokens: ${message1.usage.output_tokens}\n`);
    }

    // Example 2: Streaming
    console.log('═'.repeat(60));
    console.log('Example 2: Streaming Response');
    console.log('═'.repeat(60) + '\n');

    console.log('Streaming: "Write a short poem about bridges"\n');

    const stream = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: 'Write a short 4-line poem about bridges.',
        },
      ],
      stream: true, // Enable streaming
    });

    // Standard Anthropic SDK streaming API
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        process.stdout.write(event.delta.text);
      }
    }

    console.log('\n');

    // Example 3: With System Prompt
    console.log('\n═'.repeat(60));
    console.log('Example 3: With System Prompt');
    console.log('═'.repeat(60) + '\n');

    const message3 = await client.messages.create({
      model: 'claude-3-haiku-20240307', // Faster, cheaper model
      max_tokens: 100,
      system: 'You are a concise math tutor. Answer only with the result and one line of explanation.',
      messages: [
        {
          role: 'user',
          content: 'What is the square root of 144?',
        },
      ],
    });

    console.log('System: "You are a concise math tutor..."');
    console.log('Question: What is the square root of 144?\n');
    console.log('Response:', message3.content[0].text + '\n');

    // Example 4: Multi-turn Conversation
    console.log('═'.repeat(60));
    console.log('Example 4: Multi-turn Conversation');
    console.log('═'.repeat(60) + '\n');

    const message4 = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: 'What is the capital of France?',
        },
        {
          role: 'assistant',
          content: 'The capital of France is Paris.',
        },
        {
          role: 'user',
          content: 'What is the population of that city?',
        },
      ],
    });

    console.log('Conversation:');
    console.log('  User: What is the capital of France?');
    console.log('  Claude: The capital of France is Paris.');
    console.log('  User: What is the population of that city?');
    console.log('  Claude:', message4.content[0].text + '\n');

    // Example 5: Using with existing Anthropic SDK code
    console.log('═'.repeat(60));
    console.log('Example 5: Drop-in Replacement Demo');
    console.log('═'.repeat(60) + '\n');

    // This function expects Anthropic SDK client
    async function existingAnthropicFunction(anthropic: typeof client) {
      const msg = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 50,
        messages: [{ role: 'user', content: 'Say "Hello from Anthropic SDK wrapper!"' }],
      });
      return msg.content[0].text;
    }

    // Works without any code changes!
    const result = await existingAnthropicFunction(client);
    console.log('Result from existing function:', result, '\n');

    console.log('💡 Benefits of SDK Wrapper:');
    console.log('   ✓ Zero code changes for Anthropic SDK users');
    console.log('   ✓ Switch backends without rewriting');
    console.log('   ✓ Use familiar Claude SDK syntax');
    console.log('   ✓ Gradual migration path');
    console.log('   ✓ Works with all ai.matey features');
    console.log('   ✓ Full TypeScript support\n');

    console.log('🎯 Migration Path:');
    console.log('   1. Replace: import { Anthropic } from "@anthropic-ai/sdk"');
    console.log('      With: import { Anthropic } from "ai.matey.wrapper/anthropic"');
    console.log('   2. Create bridge with your preferred backend');
    console.log('   3. Pass bridge to Anthropic constructor');
    console.log('   4. All existing code works unchanged!\n');

    console.log('⚙️  What Works:');
    console.log('   ✓ messages.create()');
    console.log('   ✓ Streaming with for await');
    console.log('   ✓ Multi-turn conversations');
    console.log('   ✓ System prompts');
    console.log('   ✓ max_tokens, temperature, etc.');
    console.log('   ✓ All backends (OpenAI, Google, local, etc.)\n');

    console.log('📊 Format Differences (Handled Automatically):');
    console.log('   Anthropic → OpenAI:');
    console.log('     • max_tokens → max_tokens');
    console.log('     • messages.create() → chat.completions.create()');
    console.log('     • content[0].text → choices[0].message.content');
    console.log('   All conversions happen transparently!\n');

  } catch (error) {
    displayError(error, 'Anthropic SDK wrapper example');
    process.exit(1);
  }
}

main();
