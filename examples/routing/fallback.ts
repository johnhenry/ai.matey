/**
 * Fallback Router Example
 *
 * Shows automatic failover to backup backends.
 */

import { Router } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
import { OpenAIBackendAdapter } from 'ai.matey.backend/openai';

async function main() {
  const router = new Router(new OpenAIFrontendAdapter(), {
    backends: [
      // Primary backend (might fail)
      new AnthropicBackendAdapter({
        apiKey: 'invalid-key', // Will fail
      }),
      // Fallback backend
      new OpenAIBackendAdapter({
        apiKey: process.env.OPENAI_API_KEY || 'sk-...',
      }),
    ],
    strategy: 'priority', // Try first backend first
    fallbackStrategy: 'next', // Fall back to next on failure
  });

  // Listen to backend switches
  router.on('backend:switch', (event) => {
    console.log('Switched backend:', event.data);
  });

  console.log('Making request (will automatically fallback)...\n');

  try {
    const response = await router.chat({
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

  console.log('\nRouter Stats:');
  console.log(router.getStats());
}

main().catch(console.error);
