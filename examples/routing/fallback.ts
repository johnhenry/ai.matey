/**
 * Fallback Router Example
 *
 * Shows automatic failover to backup backends.
 */

import { Bridge, Router } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
import { OpenAIBackendAdapter } from 'ai.matey.backend/openai';

async function main() {
  // Create backends array
  const backends = [
    // Primary backend (might fail)
    new AnthropicBackendAdapter({
      apiKey: 'invalid-key', // Will fail
    }),
    // Fallback backend
    new OpenAIBackendAdapter({
      apiKey: process.env.OPENAI_API_KEY || 'sk-...',
    }),
  ];

  // Create router with backends array as first argument
  const router = new Router(backends, {
    strategy: 'priority', // Try first backend first
    fallbackStrategy: 'next', // Fall back to next on failure
  });

  // Create bridge with router backend and frontend adapter
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    router
  );

  console.log('Making request (will automatically fallback)...\n');

  try {
    const response = await bridge.chat({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: 'Explain what a fallback mechanism is.',
        },
      ],
    });

    console.log('Success! Used fallback backend.');
    console.log('Response:', response.choices[0].message.content);
  } catch (error) {
    console.error('All backends failed:', error);
  }
}

main().catch(console.error);
