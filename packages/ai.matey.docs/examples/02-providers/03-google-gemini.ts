/**
 * Google Gemini Provider - Using Gemini Models
 *
 * Demonstrates:
 * - Using Google Gemini models as backend
 * - Gemini Pro and Flash model variants
 * - Multimodal capabilities (text-only here)
 * - Gemini-specific features
 * - Streaming with Gemini
 *
 * Prerequisites:
 * - GOOGLE_API_KEY environment variable set
 * - ai.matey.backend package installed
 *
 * Run:
 *   npx tsx examples/02-providers/03-google-gemini.ts
 *
 * Expected Output:
 *   Responses from Gemini models demonstrating their capabilities
 *   and performance characteristics.
 */

import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { GeminiBackendAdapter } from 'ai.matey.backend/gemini';
import { requireAPIKey } from '../_shared/env-loader.js';
import { displayExampleInfo, displayResponse, displayStream, displayError } from '../_shared/helpers.js';

async function main() {
  displayExampleInfo(
    'Google Gemini Provider',
    'Use Google Gemini as your AI backend',
    [
      'GOOGLE_API_KEY environment variable',
      'ai.matey.backend package installed'
    ]
  );

  try {
    const googleKey = requireAPIKey('google');

    // Example 1: Using Gemini Pro
    console.log('\n📝 Example 1: Gemini 1.5 Pro');
    console.log('─'.repeat(60) + '\n');

    const bridge = new Bridge(
      new OpenAIFrontendAdapter(),
      new GeminiBackendAdapter({ apiKey: googleKey })
    );

    console.log('Using Gemini 1.5 Pro - powerful multimodal model\n');

    const response1 = await bridge.chat({
      model: 'gpt-4', // Maps to gemini-1.5-pro
      messages: [
        {
          role: 'user',
          content: 'Explain machine learning in 2 sentences.',
        },
      ],
      temperature: 0.7,
      max_tokens: 100
    });

    displayResponse(response1, 'Gemini Pro Response');

    // Example 2: Using Gemini Flash (faster)
    console.log('\n📝 Example 2: Gemini 1.5 Flash (Fast)');
    console.log('─'.repeat(60) + '\n');

    console.log('Using Gemini 1.5 Flash - faster, more efficient\n');

    const response2 = await bridge.chat({
      model: 'gpt-3.5-turbo', // Maps to gemini-1.5-flash
      messages: [
        {
          role: 'user',
          content: 'What is the square root of 144?',
        },
      ],
      temperature: 0,
      max_tokens: 50
    });

    displayResponse(response2, 'Gemini Flash Response');

    // Example 3: Streaming with Gemini
    console.log('\n📝 Example 3: Streaming Responses');
    console.log('─'.repeat(60) + '\n');

    console.log('Streaming response from Gemini Pro...\n');

    const stream = await bridge.chatStream({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: 'List 5 benefits of using AI in software development.',
        },
      ],
      temperature: 0.7,
      max_tokens: 200
    });

    await displayStream(stream, 'Gemini Streaming Response');

    // Example 4: Long Context with Gemini
    console.log('\n\n📝 Example 4: Long Context Processing');
    console.log('─'.repeat(60) + '\n');

    console.log('Gemini excels at long context (up to 2M tokens)...\n');

    const longContext = `
AI Matey is a universal AI adapter system that allows you to:
1. Write code once using any AI provider's format
2. Execute on any backend provider (OpenAI, Anthropic, Google, etc.)
3. Switch providers without changing your code
4. Use middleware for logging, caching, retry logic
5. Route requests across multiple providers

The system uses an Intermediate Representation (IR) to normalize
all requests and responses, making your code provider-agnostic.
    `.trim();

    const response4 = await bridge.chat({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: `Based on this description: ${longContext}\n\nWhat are the main benefits?`,
        },
      ],
      temperature: 0.7,
      max_tokens: 150
    });

    displayResponse(response4, 'Gemini Long Context Response');

    console.log('💡 Gemini Model Comparison:');
    console.log('─'.repeat(60));
    console.log('Model          Speed    Context     Cost       Use Case');
    console.log('─'.repeat(60));
    console.log('Gemini Pro     Fast     2M tokens   Medium     Complex tasks');
    console.log('Gemini Flash   Faster   1M tokens   Low        Simple tasks');
    console.log('─'.repeat(60) + '\n');

    console.log('🎯 Gemini Strengths:');
    console.log('   ✓ Extremely long context windows (up to 2M tokens)');
    console.log('   ✓ Multimodal capabilities (text, images, video, audio)');
    console.log('   ✓ Fast inference with Flash variant');
    console.log('   ✓ Competitive pricing');
    console.log('   ✓ Strong reasoning capabilities\n');

    console.log('⚙️  Configuration Options:');
    console.log('   • model: gemini-1.5-pro, gemini-1.5-flash');
    console.log('   • temperature: 0-2 (creativity control)');
    console.log('   • maxOutputTokens: response length limit');
    console.log('   • topP: nucleus sampling');
    console.log('   • topK: top-k sampling\n');

    console.log('💡 Best Use Cases:');
    console.log('   • Document analysis (large PDFs, contracts)');
    console.log('   • Codebase understanding (entire repositories)');
    console.log('   • Multimodal tasks (image + text reasoning)');
    console.log('   • Cost-effective general use\n');

  } catch (error) {
    displayError(error, 'Google Gemini provider example');
    process.exit(1);
  }
}

main();
