/**
 * OpenAI SDK Wrapper - Drop-in Replacement
 *
 * Demonstrates:
 * - Using OpenAI SDK syntax with any backend
 * - Zero code changes for existing OpenAI SDK users
 * - Seamless migration path
 * - SDK-compatible streaming
 * - Automatic format conversion
 *
 * Prerequisites:
 * - ANTHROPIC_API_KEY in web.env.local.mjs (or any other provider)
 * - ai.matey.wrapper package installed
 *
 * Run:
 *   npx tsx examples/06-sdk-wrappers/01-openai-sdk.ts
 *
 * Expected Output:
 *   OpenAI SDK code running on Anthropic (or any other) backend,
 *   demonstrating provider-agnostic development.
 */

import { OpenAI } from 'ai.matey.wrapper/openai';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
import { createLoggingMiddleware } from 'ai.matey.middleware';
import { requireAPIKey } from '../_shared/env-loader.js';
import { displayExampleInfo, displayError } from '../_shared/helpers.js';

async function main() {
  displayExampleInfo(
    'OpenAI SDK Wrapper',
    'Use OpenAI SDK syntax with any AI provider',
    [
      'ANTHROPIC_API_KEY (or any provider key) in web.env.local.mjs',
      'npm install ai.matey.wrapper'
    ]
  );

  try {
    const anthropicKey = requireAPIKey('anthropic');

    // Create bridge with Anthropic backend
    const bridge = new Bridge(
      new OpenAIFrontendAdapter(),
      new AnthropicBackendAdapter({ apiKey: anthropicKey })
    );

    // Add middleware (works same as before)
    bridge.use(
      createLoggingMiddleware({
        level: 'info',
        logRequests: false,
        logResponses: false,
      })
    );

    // Create OpenAI SDK-compatible client
    // Existing OpenAI SDK code works without changes!
    const client = new OpenAI({
      bridge, // Magic: routes through ai.matey
      apiKey: 'unused', // Not needed - bridge handles auth
    });

    console.log('\n💡 Using OpenAI SDK syntax with Anthropic backend\n');

    // Example 1: Basic Chat Completion
    console.log('═'.repeat(60));
    console.log('Example 1: Standard Chat Completion');
    console.log('═'.repeat(60) + '\n');

    // This looks like OpenAI SDK code...
    const completion1 = await client.chat.completions.create({
      model: 'gpt-4', // Requested as GPT-4
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant.',
        },
        {
          role: 'user',
          content: 'Explain what a software wrapper is in 2 sentences.',
        },
      ],
      temperature: 0.7,
      max_tokens: 100,
    });

    console.log('Request: "Explain what a software wrapper is..."');
    console.log('Model: gpt-4 (maps to claude-3-5-sonnet)');
    console.log('Backend: Anthropic\n');

    console.log('Response:');
    console.log('─'.repeat(60));
    console.log(completion1.choices[0].message.content);
    console.log('─'.repeat(60) + '\n');

    if (completion1.usage) {
      console.log('Usage:');
      console.log(`  Prompt tokens: ${completion1.usage.prompt_tokens}`);
      console.log(`  Completion tokens: ${completion1.usage.completion_tokens}`);
      console.log(`  Total tokens: ${completion1.usage.total_tokens}\n`);
    }

    // Example 2: Streaming
    console.log('═'.repeat(60));
    console.log('Example 2: Streaming Response');
    console.log('═'.repeat(60) + '\n');

    console.log('Streaming: "Count from 1 to 5"\n');

    const stream = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: 'Count from 1 to 5 with brief descriptions.',
        },
      ],
      stream: true, // Enable streaming
      max_tokens: 150,
    });

    // Standard OpenAI SDK streaming API
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      process.stdout.write(content);
    }

    console.log('\n');

    // Example 3: Multiple Messages (Conversation)
    console.log('\n═'.repeat(60));
    console.log('Example 3: Multi-turn Conversation');
    console.log('═'.repeat(60) + '\n');

    const completion3 = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful math tutor.' },
        { role: 'user', content: 'What is 15 × 8?' },
        { role: 'assistant', content: '15 × 8 = 120' },
        { role: 'user', content: 'Now divide that by 3' },
      ],
      max_tokens: 50,
    });

    console.log('Conversation:');
    console.log('  User: What is 15 × 8?');
    console.log('  AI: 15 × 8 = 120');
    console.log('  User: Now divide that by 3');
    console.log('  AI:', completion3.choices[0].message.content + '\n');

    // Example 4: Using with existing OpenAI SDK code
    console.log('═'.repeat(60));
    console.log('Example 4: Drop-in Replacement Demo');
    console.log('═'.repeat(60) + '\n');

    // This function expects OpenAI SDK client
    async function existingOpenAIFunction(openai: typeof client) {
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Say "Hello from OpenAI SDK wrapper!"' }],
        max_tokens: 20,
      });
      return response.choices[0].message.content;
    }

    // Works without any code changes!
    const result = await existingOpenAIFunction(client);
    console.log('Result from existing function:', result, '\n');

    console.log('💡 Benefits of SDK Wrapper:');
    console.log('   ✓ Zero code changes for OpenAI SDK users');
    console.log('   ✓ Switch backends without rewriting');
    console.log('   ✓ Use familiar SDK syntax');
    console.log('   ✓ Gradual migration path');
    console.log('   ✓ Works with all ai.matey features');
    console.log('   ✓ Full TypeScript support\n');

    console.log('🎯 Migration Path:');
    console.log('   1. Replace: import { OpenAI } from "openai"');
    console.log('      With: import { OpenAI } from "ai.matey.wrapper/openai"');
    console.log('   2. Create bridge with your preferred backend');
    console.log('   3. Pass bridge to OpenAI constructor');
    console.log('   4. All existing code works unchanged!\n');

    console.log('⚙️  What Works:');
    console.log('   ✓ chat.completions.create()');
    console.log('   ✓ Streaming with for await');
    console.log('   ✓ Multi-turn conversations');
    console.log('   ✓ System prompts');
    console.log('   ✓ Temperature, max_tokens, etc.');
    console.log('   ✓ All backends (Anthropic, Google, local, etc.)\n');

  } catch (error) {
    displayError(error, 'OpenAI SDK wrapper example');
    process.exit(1);
  }
}

main();
