/**
 * Anthropic Provider - Using Claude Models
 *
 * Demonstrates:
 * - Using Anthropic Claude models as backend
 * - Claude-specific features and capabilities
 * - Model selection (Sonnet, Opus, Haiku)
 * - Streaming with Claude
 * - System prompts with Anthropic
 *
 * Prerequisites:
 * - ANTHROPIC_API_KEY environment variable set
 * - ai.matey.backend package installed
 *
 * Run:
 *   npx tsx examples/02-providers/01-anthropic.ts
 *
 * Expected Output:
 *   Responses from Claude models demonstrating their capabilities
 *   and performance characteristics.
 */

import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
import { requireAPIKey } from '../_shared/env-loader.js';
import { displayExampleInfo, displayResponse, displayStream, displayError } from '../_shared/helpers.js';

async function main() {
  displayExampleInfo(
    'Anthropic Provider - Claude Models',
    'Use Anthropic Claude as your AI backend',
    [
      'ANTHROPIC_API_KEY environment variable',
      'ai.matey.backend package installed'
    ]
  );

  try {
    const anthropicKey = requireAPIKey('anthropic');

    // Example 1: Using Claude Sonnet (balanced performance)
    console.log('\n📝 Example 1: Claude 3.5 Sonnet (Balanced)');
    console.log('─'.repeat(60) + '\n');

    const bridge1 = new Bridge(
      new OpenAIFrontendAdapter(),
      new AnthropicBackendAdapter({ apiKey: anthropicKey })
    );

    console.log('Using Claude 3.5 Sonnet - balanced speed and intelligence\n');

    const response1 = await bridge1.chat({
      model: 'gpt-4', // Maps to claude-3-5-sonnet-20241022
      messages: [
        {
          role: 'user',
          content: 'Explain quantum computing in 2 sentences.',
        },
      ],
      temperature: 0.7,
      max_tokens: 100
    });

    displayResponse(response1, 'Claude Sonnet Response');

    // Example 2: Using Claude Haiku (fastest, most economical)
    console.log('\n📝 Example 2: Claude 3 Haiku (Fast & Economical)');
    console.log('─'.repeat(60) + '\n');

    console.log('Using Claude 3 Haiku - fastest responses, lowest cost\n');

    const response2 = await bridge1.chat({
      model: 'gpt-3.5-turbo', // Maps to claude-3-haiku-20240307
      messages: [
        {
          role: 'user',
          content: 'What is 15 × 24?',
        },
      ],
      temperature: 0,
      max_tokens: 50
    });

    displayResponse(response2, 'Claude Haiku Response');

    // Example 3: Streaming with Claude
    console.log('\n📝 Example 3: Streaming Responses');
    console.log('─'.repeat(60) + '\n');

    console.log('Streaming response from Claude Sonnet...\n');

    const stream = await bridge1.chatStream({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: 'Count from 1 to 10 with brief descriptions.',
        },
      ],
      temperature: 0.7,
      max_tokens: 200
    });

    await displayStream(stream, 'Claude Streaming Response');

    // Example 4: Claude with System Prompts
    console.log('\n\n📝 Example 4: System Prompts with Claude');
    console.log('─'.repeat(60) + '\n');

    const response4 = await bridge1.chat({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful coding assistant specializing in TypeScript.',
        },
        {
          role: 'user',
          content: 'How do I create a type-safe event emitter?',
        },
      ],
      temperature: 0.7,
      max_tokens: 200
    });

    displayResponse(response4, 'Claude with System Prompt');

    console.log('💡 Claude Model Comparison:');
    console.log('─'.repeat(60));
    console.log('Model           Speed    Intelligence    Cost       Use Case');
    console.log('─'.repeat(60));
    console.log('Claude Sonnet   Fast     Very High       Medium     General use');
    console.log('Claude Haiku    Fastest  High            Lowest     Simple tasks');
    console.log('Claude Opus     Slower   Highest         Highest    Complex reasoning');
    console.log('─'.repeat(60) + '\n');

    console.log('🎯 Claude Strengths:');
    console.log('   ✓ Excellent instruction following');
    console.log('   ✓ Strong reasoning capabilities');
    console.log('   ✓ Long context windows (200K tokens)');
    console.log('   ✓ Great for analysis and coding');
    console.log('   ✓ Honest about limitations\n');

    console.log('⚙️  Configuration Options:');
    console.log('   • model: claude-3-5-sonnet, claude-3-haiku, claude-3-opus');
    console.log('   • temperature: 0-1 (creativity control)');
    console.log('   • max_tokens: response length limit');
    console.log('   • top_p: nucleus sampling');
    console.log('   • top_k: top-k sampling\n');

  } catch (error) {
    displayError(error, 'Anthropic provider example');
    process.exit(1);
  }
}

main();
