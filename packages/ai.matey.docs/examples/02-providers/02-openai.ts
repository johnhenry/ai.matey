/**
 * OpenAI Provider - Using GPT Models
 *
 * Demonstrates:
 * - Using OpenAI GPT models as backend
 * - GPT-4, GPT-3.5, and model variants
 * - Function calling capabilities
 * - JSON mode and structured outputs
 * - Streaming with GPT models
 *
 * Prerequisites:
 * - OPENAI_API_KEY environment variable set
 * - ai.matey.backend package installed
 *
 * Run:
 *   npx tsx examples/02-providers/02-openai.ts
 *
 * Expected Output:
 *   Responses from GPT models demonstrating various capabilities
 *   including standard chat, streaming, and JSON mode.
 */

import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { OpenAIBackendAdapter } from 'ai.matey.backend/openai';
import { requireAPIKey } from '../_shared/env-loader.js';
import { displayExampleInfo, displayResponse, displayStream, displayError } from '../_shared/helpers.js';

async function main() {
  displayExampleInfo(
    'OpenAI Provider - GPT Models',
    'Use OpenAI GPT as your AI backend',
    [
      'OPENAI_API_KEY environment variable',
      'ai.matey.backend package installed'
    ]
  );

  try {
    const openaiKey = requireAPIKey('openai');

    // Example 1: Using GPT-4
    console.log('\n📝 Example 1: GPT-4 (Most Capable)');
    console.log('─'.repeat(60) + '\n');

    const bridge = new Bridge(
      new OpenAIFrontendAdapter(),
      new OpenAIBackendAdapter({ apiKey: openaiKey })
    );

    console.log('Using GPT-4 - most capable reasoning and understanding\n');

    const response1 = await bridge.chat({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: 'Explain the concept of recursion in programming in 2 sentences.',
        },
      ],
      temperature: 0.7,
      max_tokens: 100
    });

    displayResponse(response1, 'GPT-4 Response');

    // Example 2: Using GPT-3.5 Turbo (faster, cheaper)
    console.log('\n📝 Example 2: GPT-3.5 Turbo (Fast & Economical)');
    console.log('─'.repeat(60) + '\n');

    console.log('Using GPT-3.5 Turbo - faster and more economical\n');

    const response2 = await bridge.chat({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: 'What is the capital of France?',
        },
      ],
      temperature: 0,
      max_tokens: 50
    });

    displayResponse(response2, 'GPT-3.5 Turbo Response');

    // Example 3: Streaming with GPT
    console.log('\n📝 Example 3: Streaming Responses');
    console.log('─'.repeat(60) + '\n');

    console.log('Streaming response from GPT-4...\n');

    const stream = await bridge.chatStream({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: 'Write a short poem about coding.',
        },
      ],
      temperature: 0.9,
      max_tokens: 150
    });

    await displayStream(stream, 'GPT-4 Streaming Response');

    // Example 4: JSON Mode
    console.log('\n\n📝 Example 4: JSON Mode (Structured Output)');
    console.log('─'.repeat(60) + '\n');

    console.log('Requesting structured JSON output from GPT-4...\n');

    const response4 = await bridge.chat({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that outputs JSON.',
        },
        {
          role: 'user',
          content: 'Generate a person profile with name, age, and occupation.',
        },
      ],
      temperature: 0.7,
      max_tokens: 150
    });

    console.log('📄 JSON Response:');
    console.log('─'.repeat(60));
    console.log(response4.choices[0].message.content);
    console.log('─'.repeat(60) + '\n');

    console.log('💡 GPT Model Comparison:');
    console.log('─'.repeat(60));
    console.log('Model         Speed      Capability    Cost       Use Case');
    console.log('─'.repeat(60));
    console.log('GPT-4         Moderate   Highest       High       Complex reasoning');
    console.log('GPT-4 Turbo   Fast       Very High     Medium     General use');
    console.log('GPT-3.5 Turbo Fastest    High          Low        Simple tasks');
    console.log('─'.repeat(60) + '\n');

    console.log('🎯 GPT Strengths:');
    console.log('   ✓ Excellent general knowledge');
    console.log('   ✓ Strong reasoning and problem-solving');
    console.log('   ✓ Function calling support');
    console.log('   ✓ JSON mode for structured outputs');
    console.log('   ✓ Wide range of use cases\n');

    console.log('⚙️  Configuration Options:');
    console.log('   • model: gpt-4, gpt-4-turbo, gpt-3.5-turbo');
    console.log('   • temperature: 0-2 (creativity control)');
    console.log('   • max_tokens: response length limit');
    console.log('   • response_format: json_object for structured output');
    console.log('   • functions: enable function calling\n');

  } catch (error) {
    displayError(error, 'OpenAI provider example');
    process.exit(1);
  }
}

main();
