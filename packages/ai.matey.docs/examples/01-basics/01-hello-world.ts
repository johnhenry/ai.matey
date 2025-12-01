/**
 * Hello World - Simple Bridge Example
 *
 * Demonstrates:
 * - Creating a basic Bridge with frontend and backend adapters
 * - Making a simple chat completion request
 * - Writing code in OpenAI format but executing on Anthropic
 *
 * Prerequisites:
 * - ANTHROPIC_API_KEY environment variable set
 * - ai.matey.core, ai.matey.frontend, ai.matey.backend packages installed
 *
 * Run:
 *   npx tsx examples/01-basics/01-hello-world.ts
 *
 * Expected Output:
 *   A response from Claude (Anthropic) to the greeting, even though
 *   the request was written in OpenAI format.
 */

import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
import { requireAPIKey } from '../_shared/env-loader.js';
import { displayExampleInfo, displayResponse, displayError } from '../_shared/helpers.js';

async function main() {
  // Display example information
  displayExampleInfo(
    'Hello World - Simple Bridge',
    'The simplest possible ai.matey example: OpenAI format → Anthropic execution',
    [
      'ANTHROPIC_API_KEY environment variable',
      'Basic understanding of chat completions'
    ]
  );

  try {
    // Load API key from environment
    const anthropicKey = requireAPIKey('anthropic');

    // Create a bridge: OpenAI frontend format → Anthropic backend execution
    // This allows you to write code using OpenAI's familiar API format
    // while actually executing requests on Anthropic's Claude models
    const bridge = new Bridge(
      new OpenAIFrontendAdapter(),
      new AnthropicBackendAdapter({ apiKey: anthropicKey })
    );

    console.log('🔄 Sending request in OpenAI format...\n');

    // Make a request using OpenAI's chat completion format
    // The bridge automatically converts this to Anthropic's format
    const response = await bridge.chat({
      model: 'gpt-4', // Will be mapped to claude-3-5-sonnet-20241022
      messages: [
        {
          role: 'user',
          content: 'Say hello and explain what you are in one sentence.',
        },
      ],
      temperature: 0.7,
      max_tokens: 100,
    });

    // Display the response
    displayResponse(response, 'Claude Response (via OpenAI format)');

    console.log('✅ Success! You just used OpenAI format to call Anthropic.\n');

  } catch (error) {
    displayError(error, 'Hello World example');
    process.exit(1);
  }
}

// Run the example
main();
