/**
 * Streaming Responses - Real-time Completion
 *
 * Demonstrates:
 * - Streaming chat completions with async generators
 * - Processing chunks in real-time
 * - Displaying streaming responses to users
 *
 * Prerequisites:
 * - ANTHROPIC_API_KEY environment variable set
 * - Understanding of async iterators/generators
 *
 * Run:
 *   npx tsx packages/ai.matey.docs/examples/01-basics/02-streaming.ts
 *
 * Expected Output:
 *   Streaming text appearing character-by-character in real-time,
 *   similar to how ChatGPT displays responses.
 */

import { Bridge } from '@johnhenry/aimatey-core';
import { OpenAIFrontendAdapter } from '@johnhenry/aimatey-frontend/openai';
import { AnthropicBackendAdapter } from '@johnhenry/aimatey-backend/anthropic';
import { requireAPIKey } from '../_shared/env-loader.js';
import { displayExampleInfo, displayStream, displayError } from '../_shared/helpers.js';

async function main() {
  displayExampleInfo(
    'Streaming Responses',
    'Stream AI responses in real-time using async generators',
    [
      'ANTHROPIC_API_KEY environment variable',
      'Basic understanding of async/await and generators'
    ]
  );

  try {
    const anthropicKey = requireAPIKey('anthropic');

    // Create bridge with OpenAI frontend and Anthropic backend
    const bridge = new Bridge(
      new OpenAIFrontendAdapter(),
      new AnthropicBackendAdapter({ apiKey: anthropicKey })
    );

    console.log('🔄 Starting streaming request...\n');

    // Request a streaming response
    // The stream option tells the backend to return chunks as they're generated
    const stream = await bridge.chatStream({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: 'Write a haiku about coding with AI. Be creative!',
        },
      ],
      temperature: 0.8,
      stream: true, // Enable streaming
    });

    // Display the stream as it comes in
    // This will print each chunk immediately, creating a "typing" effect
    const fullText = await displayStream(stream, 'Streaming Haiku');

    console.log(`\n📏 Total characters received: ${fullText.length}`);
    console.log('✅ Streaming completed successfully!\n');

    // Pro tip: In a real application, you might send these chunks
    // to a WebSocket, Server-Sent Events (SSE), or React state
    console.log('💡 Tip: Streaming is perfect for:');
    console.log('   • Interactive chat interfaces');
    console.log('   • Long-form content generation');
    console.log('   • Improving perceived performance\n');

  } catch (error) {
    displayError(error, 'Streaming example');
    process.exit(1);
  }
}

main();
