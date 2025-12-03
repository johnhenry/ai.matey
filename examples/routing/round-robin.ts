/**
 * Round-Robin Router Example
 *
 * Shows how to distribute requests across multiple backends.
 */

import { Bridge, Router } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
import { OpenAIBackendAdapter } from 'ai.matey.backend/openai';
import { GeminiBackendAdapter } from 'ai.matey.backend/gemini';

async function main() {
  // Create backends array
  const backends = [
    new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    }),
    new OpenAIBackendAdapter({
      apiKey: process.env.OPENAI_API_KEY || 'sk-...',
    }),
    new GeminiBackendAdapter({
      apiKey: process.env.GEMINI_API_KEY || 'AIza...',
    }),
  ];

  // Create router with backends array as first argument
  const router = new Router(backends, {
    strategy: 'round-robin', // Cycle through backends
    fallbackStrategy: 'next', // Try next backend on failure
  });

  // Create bridge with router backend and frontend adapter
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    router
  );

  // Make multiple requests - they'll be distributed across backends
  for (let i = 1; i <= 5; i++) {
    console.log(`\nRequest ${i}:`);

    const response = await bridge.chat({
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
}

main().catch(console.error);
