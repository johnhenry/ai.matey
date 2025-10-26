/**
 * Round-Robin Router Example
 *
 * Shows how to distribute requests across multiple backends.
 */

import {
  Router,
  OpenAIFrontendAdapter,
  AnthropicBackendAdapter,
  OpenAIBackendAdapter,
  GeminiBackendAdapter,
} from 'ai.matey';

async function main() {
  // Create router with multiple backends
  const router = new Router(new OpenAIFrontendAdapter(), {
    backends: [
      new AnthropicBackendAdapter({
        apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
      }),
      new OpenAIBackendAdapter({
        apiKey: process.env.OPENAI_API_KEY || 'sk-...',
      }),
      new GeminiBackendAdapter({
        apiKey: process.env.GEMINI_API_KEY || 'AIza...',
      }),
    ],
    strategy: 'round-robin', // Cycle through backends
    fallbackStrategy: 'next', // Try next backend on failure
  });

  // Make multiple requests - they'll be distributed across backends
  for (let i = 1; i <= 5; i++) {
    console.log(`\nRequest ${i}:`);

    const response = await router.chat({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: `Count to ${i}`,
        },
      ],
    });

    console.log('Response:', response.choices[0].message.content);
  }

  // Show stats
  console.log('\nRouter Stats:');
  console.log(router.getStats());
}

main().catch(console.error);
